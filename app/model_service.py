from typing import Optional, List
from app import db
from app.models import Alert, Zone, AlertStatus, ZoneStatus, User, Ticker


class AlertManager:
    @staticmethod
    def create_alert(user: User, ticker: Ticker,
                     alert_type: str, price: float, notes: Optional[str] = None) -> Alert:
        """Create a new alert"""
        alert = Alert(
            user_id=user.id,
            ticker_id=ticker.id,
            symbol=ticker.symbol,
            type=alert_type,
            price=price,
            notes=notes,
            status=AlertStatus.ACTIVE
        )
        db.session.add(alert)
        db.session.commit()
        return alert

    @staticmethod
    def update_alert(alert_id: int, alert_type: Optional[str] = None,
                     price: Optional[float] = None, notes: Optional[str] = None) -> Optional[Alert]:
        """Update an existing alert"""
        alert = db.session.get(Alert, alert_id)
        if alert:
            if alert_type is not None:
                alert.type = alert_type
            if price is not None:
                alert.price = price
            if notes is not None:
                alert.notes = notes
            db.session.commit()
        return alert

    @staticmethod
    def delete_alert(alert_id: int) -> bool:
        """Delete an alert"""
        alert = db.session.get(Alert, alert_id)
        if alert:
            db.session.delete(alert)
            db.session.commit()
            return True
        return False

    @staticmethod
    def get_active_alerts_for_ticker(ticker_id: int) -> List[Alert]:
        """Get all active alerts for a specific ticker"""
        return Alert.query.filter_by(
            ticker_id=ticker_id,
            status=AlertStatus.ACTIVE
        ).all()


class ZoneManager:
    @staticmethod
    def create_zone(user: User, ticker: Ticker,
                    zone_type: str, entry: float, stoploss: float,
                    target: float, notes: Optional[str] = None) -> Zone:
        """Create a new trading zone"""
        zone = Zone(
            user_id=user.id,
            ticker_id=ticker.id,
            symbol=ticker.symbol,
            type=zone_type,
            entry=entry,
            stoploss=stoploss,
            target=target,
            notes=notes,
            status=ZoneStatus.ACTIVE
        )
        db.session.add(zone)
        db.session.commit()
        return zone

    @staticmethod
    def update_zone(zone_id: int, entry: Optional[float] = None,
                    stoploss: Optional[float] = None,
                    target: Optional[float] = None, notes: Optional[str] = None) -> Optional[Zone]:
        """Update an existing zone"""
        zone = db.session.get(Zone, zone_id)
        if zone:
            if entry is not None:
                zone.entry = entry
            if stoploss is not None:
                zone.stoploss = stoploss
            if target is not None:
                zone.target = target
            if notes is not None:
                zone.notes = notes
            db.session.commit()
        return zone

    @staticmethod
    def delete_zone(zone_id: int) -> bool:
        """Delete a zone"""
        zone = db.session.get(Zone, zone_id)
        if zone:
            db.session.delete(zone)
            db.session.commit()
            return True
        return False

    @staticmethod
    def get_active_zones_for_ticker(ticker_id: int) -> List[Zone]:
        """Get all active zones for a specific ticker"""
        return Zone.query.filter_by(
            ticker_id=ticker_id,
        ).where(
            Zone.status.in_([ZoneStatus.ACTIVE, ZoneStatus.ENTRY_HIT])
        ).all()