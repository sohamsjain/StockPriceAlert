#!/usr/bin/env python3
"""
Export User Zones Script
========================
Simple script to export zones for a specific user to JSON format.
Run this before updating your production database to backup zone data.

Usage:
    python export_user_zones.py --user-id 1
    python export_user_zones.py --email user@example.com
    python export_user_zones.py --all
"""

import json
import argparse
import sys
from datetime import datetime
from pathlib import Path

# Add the app directory to path so we can import our models
sys.path.insert(0, '.')

try:
    from app import create_app, db
    from app.models import User, Zone, Ticker
except ImportError as e:
    print(f"Error importing app modules: {e}")
    print("Make sure you're running this script from the project root directory.")
    sys.exit(1)


def serialize_datetime(obj):
    """JSON serializer for datetime objects"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def export_zones_for_user(user_id=None, email=None):
    """Export zones for a specific user"""
    app = create_app()

    with app.app_context():
        # Find the user
        if user_id:
            user = db.session.get(User, user_id)
            if not user:
                print(f"Error: User with ID {user_id} not found.")
                return None
        elif email:
            user = User.query.filter_by(email=email).first()
            if not user:
                print(f"Error: User with email {email} not found.")
                return None
        else:
            print("Error: Either user_id or email must be provided.")
            return None

        print(f"Found user: {user.name} ({user.email})")

        # Get all zones for this user
        zones = Zone.query.filter_by(user_id=user.id).order_by(Zone.created_at.desc()).all()

        if not zones:
            print(f"No zones found for user {user.name}")
            return None

        print(f"Found {len(zones)} zones for user {user.name}")

        # Prepare export data
        export_data = {
            'export_info': {
                'timestamp': datetime.now().isoformat(),
                'script_version': '1.0',
                'user_id': user.id,
                'user_name': user.name,
                'user_email': user.email,
                'total_zones': len(zones)
            },
            'zones': []
        }

        # Export each zone with all relevant data
        for zone in zones:
            zone_data = {
                'id': zone.id,
                'symbol': zone.symbol,
                'type': zone.type,
                'status': zone.status,
                'entry': zone.entry,
                'stoploss': zone.stoploss,
                'target': zone.target,
                'created_at': zone.created_at.isoformat() if zone.created_at else None,
                'entry_at': zone.entry_at.isoformat() if zone.entry_at else None,
                'stoploss_at': zone.stoploss_at.isoformat() if zone.stoploss_at else None,
                'target_at': zone.target_at.isoformat() if zone.target_at else None,
                'failed_at': zone.failed_at.isoformat() if zone.failed_at else None,
                'user_id': zone.user_id,
                'ticker_id': zone.ticker_id,
                # Include ticker info for completeness
                'ticker_symbol': zone.ticker.symbol if zone.ticker else zone.symbol,
                'ticker_name': zone.ticker.name if zone.ticker else None,
                'ticker_exchange': zone.ticker.exchange if zone.ticker else None
            }
            export_data['zones'].append(zone_data)

        return export_data


def export_all_zones():
    """Export zones for all users"""
    app = create_app()

    with app.app_context():
        users = User.query.all()
        if not users:
            print("No users found in database.")
            return None

        print(f"Found {len(users)} users in database")

        export_data = {
            'export_info': {
                'timestamp': datetime.now().isoformat(),
                'script_version': '1.0',
                'export_type': 'all_users',
                'total_users': len(users)
            },
            'users': []
        }

        total_zones = 0

        for user in users:
            zones = Zone.query.filter_by(user_id=user.id).order_by(Zone.created_at.desc()).all()

            user_data = {
                'user_info': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email,
                    'zone_count': len(zones)
                },
                'zones': []
            }

            for zone in zones:
                zone_data = {
                    'id': zone.id,
                    'symbol': zone.symbol,
                    'type': zone.type,
                    'status': zone.status,
                    'entry': zone.entry,
                    'stoploss': zone.stoploss,
                    'target': zone.target,
                    'created_at': zone.created_at.isoformat() if zone.created_at else None,
                    'entry_at': zone.entry_at.isoformat() if zone.entry_at else None,
                    'stoploss_at': zone.stoploss_at.isoformat() if zone.stoploss_at else None,
                    'target_at': zone.target_at.isoformat() if zone.target_at else None,
                    'failed_at': zone.failed_at.isoformat() if zone.failed_at else None,
                    'ticker_id': zone.ticker_id,
                    'ticker_symbol': zone.ticker.symbol if zone.ticker else zone.symbol,
                    'ticker_name': zone.ticker.name if zone.ticker else None,
                    'ticker_exchange': zone.ticker.exchange if zone.ticker else None
                }
                user_data['zones'].append(zone_data)

            total_zones += len(zones)
            export_data['users'].append(user_data)
            print(f"User: {user.name} ({user.email}) - {len(zones)} zones")

        export_data['export_info']['total_zones'] = total_zones
        print(f"\nTotal zones across all users: {total_zones}")

        return export_data


def save_export_data(export_data, filename=None):
    """Save export data to JSON file"""
    if not export_data:
        print("No data to export.")
        return False

    # Generate filename if not provided
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if 'export_type' in export_data['export_info'] and export_data['export_info']['export_type'] == 'all_users':
            filename = f"zones_export_all_users_{timestamp}.json"
        else:
            user_email = export_data['export_info']['user_email'].replace('@', '_at_').replace('.', '_')
            filename = f"zones_export_{user_email}_{timestamp}.json"

    # Ensure exports directory exists
    exports_dir = Path("exports")
    exports_dir.mkdir(exist_ok=True)

    filepath = exports_dir / filename

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False, default=serialize_datetime)

        print(f"\nExport successful!")
        print(f"File saved: {filepath}")
        print(f"File size: {filepath.stat().st_size} bytes")

        return True

    except Exception as e:
        print(f"Error saving export file: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Export user zones to JSON format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python export_user_zones.py --user-id 1
  python export_user_zones.py --email john@example.com
  python export_user_zones.py --all
  python export_user_zones.py --user-id 1 --output my_zones.json
        """
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--user-id', type=int, help='User ID to export zones for')
    group.add_argument('--email', help='User email to export zones for')
    group.add_argument('--all', action='store_true', help='Export zones for all users')

    parser.add_argument('--output', help='Output filename (optional)')

    args = parser.parse_args()

    print("=" * 50)
    print("Zone Export Script")
    print("=" * 50)

    # Export zones
    if args.all:
        print("Exporting zones for all users...")
        export_data = export_all_zones()
    else:
        print(f"Exporting zones for user...")
        export_data = export_zones_for_user(user_id=args.user_id, email=args.email)

    # Save to file
    if export_data:
        success = save_export_data(export_data, args.output)
        if success:
            print("\nExport completed successfully!")
            print("Keep this file safe for potential restoration after database update.")
        else:
            print("\nExport failed!")
            sys.exit(1)
    else:
        print("\nNo data to export.")
        sys.exit(1)


if __name__ == "__main__":
    main()