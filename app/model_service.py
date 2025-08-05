from typing import Optional, List
from app import db
from app.models import Zone, ZoneStatus, User, Ticker


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