from kiteconnect import KiteTicker
from datetime import datetime, timezone, timedelta
import logging
import time
from collections import defaultdict, deque
from sqlalchemy import select
from app import db, create_app
from app.models import Ticker, User
from kite import Kite
from app.model_service import ZoneManager
from notification_service import NotificationManager
import threading
import pytz
import signal

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# IST timezone
IST = pytz.timezone('Asia/Kolkata')


class CandleData:
    """Represents a 5-second candle"""

    def __init__(self, timestamp, open_price):
        self.timestamp = timestamp
        self.open = open_price
        self.high = open_price
        self.low = open_price
        self.close = open_price
        self.volume = 0
        self.tick_count = 0

    def update_tick(self, price, volume=0):
        self.high = max(self.high, price)
        self.low = min(self.low, price)
        self.close = price
        self.volume += volume
        self.tick_count += 1

    def is_complete(self, current_time):
        return (current_time - self.timestamp).total_seconds() >= 5

    def __repr__(self):
        return f"Candle(O:{self.open} H:{self.high} L:{self.low} C:{self.close} V:{self.volume})"


class TickerManager:
    def __init__(self):
        self.kws = None
        self.tickers = {}
        self.zone_manager = ZoneManager()
        self.app = create_app()
        self.k = None
        self.is_running = False
        self.current_candles = {}
        self.candle_history = defaultdict(lambda: deque(maxlen=20))
        self.data_lock = threading.Lock()
        self.candle_timer = None
        self.last_connect_time = None
        self.connected = False  # Tracks if on_connect fired

    def initialize_connection(self):
        """Initialize KiteTicker connection with auto-login"""
        try:
            # Clean old Kite instance
            self.k = Kite()

            if not self.k.ensure_login():
                logger.error("Failed to login to Kite")
                with self.app.app_context():
                    admins = User.query.where(User.is_admin == True).all()
                    for admin in admins:
                        NotificationManager.send_kite_login_alert(admin)
                return False

            logger.info("Successfully logged in to Kite")

            # Always create fresh KiteTicker instance
            self.kws = KiteTicker(self.k.api_key, self.k.access_token)
            self.connected = False  # Reset connect flag
            self.last_connect_time = None

            self.setup_handlers()
            self.start_candle_processor()
            return True

        except Exception as e:
            logger.error(f"Failed to initialize KiteTicker: {e}")
            return False

    def setup_handlers(self):
        self.kws.on_ticks = self.on_ticks
        self.kws.on_connect = self.on_connect
        self.kws.on_close = self.on_close
        self.kws.on_error = self.on_error
        self.kws.on_reconnect = self.on_reconnect
        self.kws.on_noreconnect = self.on_noreconnect

    def start_candle_processor(self):
        self.process_completed_candles()
        self.candle_timer = threading.Timer(1.0, self.start_candle_processor)
        self.candle_timer.start()

    def stop_candle_processor(self):
        if self.candle_timer:
            self.candle_timer.cancel()

    def load_tickers(self):
        try:
            with self.app.app_context():
                stmt = select(Ticker)
                tickers = db.session.execute(stmt).scalars().all()
                self.tickers = {ticker.instrument_token: ticker for ticker in tickers}
                return list(self.tickers.keys())
        except Exception as e:
            logger.error(f"Failed to load tickers: {e}")
            return []

    def is_trading_hours(self, tick_time):
        tick_time_ist = tick_time.astimezone(IST)
        if tick_time_ist.weekday() >= 5:
            return False
        market_start = tick_time_ist.replace(hour=9, minute=15, second=0, microsecond=0)
        market_end = tick_time_ist.replace(hour=15, minute=30, second=0, microsecond=0)
        return market_start <= tick_time_ist <= market_end

    def get_candle_timestamp(self, timestamp):
        if timestamp.tzinfo is None:
            timestamp_ist = IST.localize(timestamp)
        else:
            timestamp_ist = timestamp.astimezone(IST)
        seconds = timestamp_ist.second
        floored_seconds = (seconds // 5) * 5
        return timestamp_ist.replace(second=floored_seconds, microsecond=0)

    def process_tick(self, instrument_token, price, volume=0, timestamp=None):
        if timestamp is None:
            timestamp = datetime.now(timezone.utc)
        candle_timestamp = self.get_candle_timestamp(timestamp)

        with self.data_lock:
            if (instrument_token not in self.current_candles or
                    self.current_candles[instrument_token].timestamp != candle_timestamp):
                if instrument_token in self.current_candles:
                    prev_candle = self.current_candles[instrument_token]
                    self.candle_history[instrument_token].append(prev_candle)
                self.current_candles[instrument_token] = CandleData(candle_timestamp, price)

            self.current_candles[instrument_token].update_tick(price, volume)

    def process_completed_candles(self):
        current_time = datetime.now(IST)
        completed_instruments = []
        with self.data_lock:
            for instrument_token, candle in self.current_candles.items():
                if candle.is_complete(current_time):
                    completed_instruments.append((instrument_token, candle))

        for instrument_token, candle in completed_instruments:
            try:
                ticker = self.tickers[instrument_token]
                self.update_ticker_price(ticker, candle.close, current_time)
                self.check_zones(ticker.id, candle.close, candle)
                with self.data_lock:
                    if instrument_token in self.current_candles:
                        self.candle_history[instrument_token].append(candle)
                        del self.current_candles[instrument_token]
            except Exception as e:
                logger.error(f"Error processing completed candle for {instrument_token}: {e}")

    def update_ticker_price(self, ticker, price, timestamp):
        try:
            with self.app.app_context():
                db_ticker = db.session.get(Ticker, ticker.id)
                if db_ticker:
                    db_ticker.last_price = price
                    db_ticker.last_updated = timestamp
                    db.session.commit()
        except Exception as e:
            logger.error(f"Failed to update ticker {ticker.symbol}: {e}")
            with self.app.app_context():
                db.session.rollback()

    def check_zones(self, ticker_id, current_price, candle: CandleData):
        try:
            with self.app.app_context():
                active_zones = self.zone_manager.get_active_zones_for_ticker(ticker_id)
                for zone in active_zones:
                    if self.check_zone_with_candle(zone, candle):
                        logger.info(f"Zone status changed: {zone} (Candle: {candle})")
                        NotificationManager.send_zone_notification(zone.user, zone)
        except Exception as e:
            logger.error(f"Error checking alerts/zones for ticker {ticker_id}: {e}")

    def check_zone_with_candle(self, zone, candle: CandleData) -> bool:
        from app.models import ZoneType, ZoneStatus
        now = datetime.now(IST)
        status_changed = False
        candle_high = candle.high
        candle_low = candle.low

        if zone.status == ZoneStatus.ACTIVE:
            if zone.type == ZoneType.LONG:
                if candle_low <= zone.stoploss:
                    zone.status = ZoneStatus.FAILED
                    zone.failed_at = now
                    status_changed = True
                elif candle_low <= zone.entry:
                    zone.status = ZoneStatus.ENTRY_HIT
                    zone.entry_at = now
                    status_changed = True
            else:
                if candle_high >= zone.stoploss:
                    zone.status = ZoneStatus.FAILED
                    zone.failed_at = now
                    status_changed = True
                elif candle_high >= zone.entry:
                    zone.status = ZoneStatus.ENTRY_HIT
                    zone.entry_at = now
                    status_changed = True

        elif zone.status == ZoneStatus.ENTRY_HIT:
            if zone.type == ZoneType.LONG:
                if candle_low <= zone.stoploss:
                    zone.status = ZoneStatus.STOPLOSS_HIT
                    zone.stoploss_at = now
                    status_changed = True
                elif candle_high >= zone.target:
                    zone.status = ZoneStatus.TARGET_HIT
                    zone.target_at = now
                    status_changed = True
            else:
                if candle_high >= zone.stoploss:
                    zone.status = ZoneStatus.STOPLOSS_HIT
                    zone.stoploss_at = now
                    status_changed = True
                elif candle_low <= zone.target:
                    zone.status = ZoneStatus.TARGET_HIT
                    zone.target_at = now
                    status_changed = True

        if status_changed:
            db.session.commit()
        return status_changed

    def on_ticks(self, ws, ticks):
        for tick in ticks:
            try:
                if 'last_price' in tick and 'last_trade_time' in tick and tick['instrument_token'] in self.tickers:
                    last_trade_time = tick['last_trade_time']
                    if not self.is_trading_hours(last_trade_time):
                        continue
                    self.process_tick(tick['instrument_token'], tick['last_price'], tick.get('volume', 0), last_trade_time)
            except Exception as e:
                logger.error(f"Error processing tick: {e}")

    def on_connect(self, ws, response):
        logger.info("Successfully connected to WebSocket")
        self.connected = True
        self.last_connect_time = datetime.now()
        instrument_tokens = self.load_tickers()
        if instrument_tokens:
            ws.subscribe(instrument_tokens)
            ws.set_mode(ws.MODE_FULL, instrument_tokens)
            logger.info(f"Subscribed to {len(instrument_tokens)} instruments")
        else:
            logger.warning("No instruments to subscribe to")

    def on_close(self, ws, code, reason):
        logger.warning(f"Connection closed: {code} - {reason}")
        self.is_running = False
        self.stop_candle_processor()

    def on_error(self, ws, code, reason):
        logger.error(f"Error in WebSocket: {code} - {reason}")
        self.is_running = False
        self.stop_candle_processor()

    def on_reconnect(self, ws, attempts_count):
        logger.info(f"Reconnecting... {attempts_count} attempt(s)")

    def on_noreconnect(self, ws):
        logger.error("Maximum reconnection attempts reached")
        self.is_running = False
        self.stop_candle_processor()

    def start(self):
        try:
            self.is_running = True
            self.kws.connect(threaded=True)
            logger.info("WebSocket connection started")
        except Exception as e:
            logger.error(f"Failed to start WebSocket: {e}")
            self.is_running = False

    def stop(self):
        try:
            self.is_running = False
            self.stop_candle_processor()
            if self.kws:
                self.kws.close()
                self.kws = None  # Force fresh connection next time
            logger.info("WebSocket connection stopped")
        except Exception as e:
            logger.error(f"Error stopping WebSocket: {e}")

    def check_market_hours(self):
        now = datetime.now(IST)
        if now.weekday() >= 5:
            return False
        market_start = now.replace(hour=8, minute=15, second=0, microsecond=0)
        market_end = now.replace(hour=15, minute=30, second=0, microsecond=0)
        return market_start <= now <= market_end

    def run_forever(self):
        retry_count = 0
        max_retries = 3

        while True:
            try:
                if self.check_market_hours():
                    if not self.is_running:
                        logger.info("Market hours started. Initializing connection...")
                        if self.initialize_connection():
                            self.start()
                            retry_count = 0
                            # Wait max 5s for on_connect, else restart
                            time.sleep(5)
                            if not self.connected:
                                logger.error("WebSocket did not connect in time. Retrying...")
                                self.stop()
                                continue
                        else:
                            retry_count += 1
                            if retry_count >= max_retries:
                                logger.error(f"Failed to initialize connection after {max_retries} attempts. Waiting 30 minutes...")
                                time.sleep(1800)
                                retry_count = 0
                            else:
                                logger.error(f"Failed to initialize connection (attempt {retry_count}/{max_retries}). Retrying in 60 seconds...")
                                time.sleep(60)
                            continue
                else:
                    if self.is_running:
                        logger.info("Market hours over. Stopping connection...")
                        self.stop()
                        retry_count = 0
                    else:
                        next_market_time = self.get_next_market_time()
                        sleep_seconds = (next_market_time - datetime.now(IST)).total_seconds()
                        logger.info(f"Markets closed. Sleeping until {next_market_time}")
                        time.sleep(min(sleep_seconds, 3600))
                        continue

                time.sleep(5)

            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}")
                if self.is_running:
                    self.stop()
                retry_count += 1
                if retry_count >= max_retries:
                    logger.error(f"Too many errors in main loop. Waiting 10 minutes...")
                    time.sleep(600)
                    retry_count = 0
                else:
                    time.sleep(60)

    @staticmethod
    def get_next_market_time():
        now = datetime.now(IST)
        market_start = now.replace(hour=8, minute=15, second=0, microsecond=0)
        next_day = now + timedelta(days=1) if now > market_start else now
        while True:
            if next_day.weekday() < 5:
                return next_day.replace(hour=8, minute=15, second=0, microsecond=0)
            next_day += timedelta(days=1)

    def get_candle_stats(self):
        with self.data_lock:
            stats = {}
            current_time = datetime.now(IST)
            for instrument_token, candle in self.current_candles.items():
                ticker = self.tickers[instrument_token]
                stats[ticker.symbol] = {
                    'ticks': candle.tick_count,
                    'candle': str(candle),
                    'age_seconds': (current_time - candle.timestamp).total_seconds()
                }
            return stats


def main():
    logger.info("Starting Raven WebSocket Manager with 5-second candle resampling")
    manager = TickerManager()

    def print_stats():
        if manager.is_running:
            stats = manager.get_candle_stats()
            if stats:
                logger.info(f"Current candle stats: {len(stats)} active candles")
        if manager.is_running:
            threading.Timer(30.0, print_stats).start()

    threading.Timer(30.0, print_stats).start()
    manager.run_forever()


if __name__ == "__main__":
    main()
