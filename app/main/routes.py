from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_required, current_user
from app.models import Ticker, Zone, db, ZoneStatus
from app.model_service import ZoneManager
from app.main import bp


@bp.route('/')
@bp.route('/index')
def index():
    # Show front page for non-authenticated users, redirect to alerts for logged-in users
    if current_user.is_authenticated:
        return redirect(url_for('main.zones'))
    return render_template('index.html', title='Raven - Smart Trading Alerts')


@bp.route('/api/tickers/search')
@login_required
def search_tickers():
    query = request.args.get('q', '').upper()
    if len(query) < 1:
        return jsonify({'tickers': []})

    tickers = Ticker.query.filter(Ticker.symbol.like(f'{query}%')).limit(10).all()
    return jsonify({
        'tickers': [{
            'symbol': ticker.symbol,
            'last_price': ticker.last_price
        } for ticker in tickers]
    })


@bp.route('/zones')
@login_required
def zones():
    zones = Zone.query.filter_by(user_id=current_user.id).order_by(Zone.updated_at.desc()).all()
    active = [zone for zone in zones if zone.status == ZoneStatus.ACTIVE]
    entry_hit = [zone for zone in zones if zone.status == ZoneStatus.ENTRY_HIT]
    stoploss_hit = [zone for zone in zones if zone.status == ZoneStatus.STOPLOSS_HIT]
    target_hit = [zone for zone in zones if zone.status == ZoneStatus.TARGET_HIT]
    failed = [zone for zone in zones if zone.status == ZoneStatus.FAILED]
    stats = {
        'active': active,
        'entry_hit': entry_hit,
        'stoploss_hit': stoploss_hit,
        'target_hit': target_hit,
        'failed': failed
    }
    return render_template('zones/index.html', zones=zones, stats=stats)


@bp.route('/api/zones')
@login_required
def get_zones():
    zones = Zone.query.filter_by(user_id=current_user.id).order_by(Zone.updated_at.desc()).all()
    return jsonify({
        'zones': [{
            'id': zone.id,
            'symbol': zone.symbol,
            'type': zone.type,
            'entry': zone.entry,
            'stoploss': zone.stoploss,
            'target': zone.target,
            'status': zone.status,
            'notes': zone.notes,  # Include notes in response
            'created_at': zone.created_at.isoformat(),
            'entry_at': zone.entry_at.isoformat() if zone.entry_at else None,
            'target_at': zone.target_at.isoformat() if zone.target_at else None,
            'stoploss_at': zone.stoploss_at.isoformat() if zone.stoploss_at else None,
            'failed_at': zone.failed_at.isoformat() if zone.failed_at else None,
            'last_price': zone.ticker.last_price if zone.ticker else None
        } for zone in zones]
    })


@bp.route('/api/zones/create', methods=['POST'])
@login_required
def create_zone():
    try:
        data = request.get_json()

        # Get or create ticker
        ticker = Ticker.query.filter_by(symbol=data['symbol']).first()
        if not ticker:
            return jsonify({'error': 'Invalid symbol'}), 400

        # Infer zone type from entry, stoploss, target values
        entry = float(data['entry'])
        stoploss = float(data['stoploss'])
        target = float(data['target'])

        # Zone type inference logic
        if target > entry and stoploss < entry:
            zone_type = "Long Zone"
        elif target < entry and stoploss > entry:
            zone_type = "Short Zone"
        else:
            return jsonify({
                'error': 'Invalid zone configuration. For Long zones: target > entry > stoploss. For Short zones: stoploss > entry > target.'}), 400

        zone = ZoneManager.create_zone(
            user=current_user,
            ticker=ticker,
            zone_type=zone_type,  # Use inferred type
            entry=entry,
            stoploss=stoploss,
            target=target,
            notes=data.get('notes')
        )

        return jsonify({
            'message': 'Zone created successfully',
            'zone': {
                'id': zone.id,
                'symbol': zone.symbol,
                'type': zone.type,
                'entry': zone.entry,
                'stoploss': zone.stoploss,
                'target': zone.target,
                'status': zone.status,
                'notes': zone.notes,
                'created_at': zone.created_at.isoformat(),
                'last_price': zone.ticker.last_price if zone.ticker else None
            }
        }), 201

    except ValueError as e:
        return jsonify({'error': 'Invalid number format'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@bp.route('/api/zones/<int:zone_id>', methods=['DELETE'])
@bp.route('/api/zones', methods=['DELETE'])
@login_required
def delete_zone(zone_id=None):
    try:
        if zone_id:
            # Single zone deletion (existing functionality)
            zone = Zone.query.get_or_404(zone_id)

            # Check if the zone belongs to the current user
            if zone.user_id != current_user.id:
                return jsonify({'error': 'Unauthorized'}), 403

            if ZoneManager.delete_zone(zone_id):
                return jsonify({'message': 'Zone deleted successfully'}), 200
            return jsonify({'error': 'Zone not found'}), 404

        else:
            # Multiple zone deletion
            zone_ids = request.args.get('ids')
            if not zone_ids:
                return jsonify({'error': 'No zones selected for deletion'}), 400

            # Parse comma-separated IDs
            try:
                zone_ids_list = [int(id.strip()) for id in zone_ids.split(',') if id.strip()]
            except ValueError:
                return jsonify({'error': 'Invalid zone IDs format'}), 400

            if not zone_ids_list:
                return jsonify({'error': 'No valid zone IDs provided'}), 400

            deleted_count = 0
            unauthorized_zones = []
            not_found_zones = []

            for zone_id in zone_ids_list:
                zone = Zone.query.get(zone_id)

                if not zone:
                    not_found_zones.append(zone_id)
                    continue

                # Check if the zone belongs to the current user
                if zone.user_id != current_user.id:
                    unauthorized_zones.append(f"{zone.symbol} (ID: {zone_id})")
                    continue

                if ZoneManager.delete_zone(zone_id):
                    deleted_count += 1

            # Prepare response message
            messages = []
            if deleted_count > 0:
                messages.append(f'{deleted_count} zone(s) deleted successfully')

            if unauthorized_zones:
                messages.append(f'Unauthorized to delete: {", ".join(unauthorized_zones)}')

            if not_found_zones:
                messages.append(f'Zones not found: {", ".join(map(str, not_found_zones))}')

            # Determine response status
            if deleted_count > 0:
                return jsonify({
                    'message': '; '.join(messages),
                    'deleted_count': deleted_count,
                    'errors': len(unauthorized_zones) + len(not_found_zones)
                }), 200
            else:
                return jsonify({
                    'error': '; '.join(messages) if messages else 'No zones were deleted'
                }), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


# Add this single route to your existing routes file
# Place it after your existing @bp.route('/api/zones', methods=['DELETE']) route

@bp.route('/api/zones/<int:zone_id>', methods=['GET'])
@login_required
def get_zone_details(zone_id):
    """Get detailed information for a specific zone"""
    try:
        # Get the zone with user ownership check
        zone = Zone.query.filter_by(id=zone_id, user_id=current_user.id).first()

        if not zone:
            return jsonify({
                'error': 'Zone not found or access denied'
            }), 404

        # Format the zone data for the frontend
        zone_data = {
            'id': zone.id,
            'symbol': zone.symbol,
            'type': zone.type,
            'status': zone.status,
            'notes': zone.notes,

            # Price levels
            'entry': float(zone.entry),
            'stoploss': float(zone.stoploss),
            'target': float(zone.target),

            # Calculated metrics
            'risk_per_unit': float(zone.risk_per_unit),
            'reward_per_unit': float(zone.reward_per_unit),
            'reward_to_risk_ratio': float(zone.reward_to_risk_ratio),

            # Timestamps (convert to ISO format for JavaScript)
            'created_at': zone.created_at.isoformat(),
            'updated_at': zone.updated_at.isoformat() if zone.updated_at else None,
            'entry_at': zone.entry_at.isoformat() if zone.entry_at else None,
            'stoploss_at': zone.stoploss_at.isoformat() if zone.stoploss_at else None,
            'target_at': zone.target_at.isoformat() if zone.target_at else None,
            'failed_at': zone.failed_at.isoformat() if zone.failed_at else None,

            # Include ticker information
            'ticker': {
                'symbol': zone.ticker.symbol,
                'last_price': float(zone.ticker.last_price) if zone.ticker.last_price else None
            } if zone.ticker else None
        }

        return jsonify({
            'success': True,
            'zone': zone_data
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch zone details',
            'details': str(e)
        }), 500

# OPTIONAL: If your ZoneManager.update_zone doesn't handle 'symbol' field updates,
# you might need to modify your existing update_zone route to handle symbol updates.
# But based on your existing code, it should work fine as-is.


@bp.route('/api/zones/<int:zone_id>', methods=['PUT'])
@login_required
def update_zone(zone_id):
    try:
        zone = Zone.query.get_or_404(zone_id)

        # Check if the zone belongs to the current user
        if zone.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        updated_zone = ZoneManager.update_zone(
            zone_id=zone_id,
            entry=data.get('entry'),
            stoploss=data.get('stoploss'),
            target=data.get('target'),
            notes=data.get('notes')  # Handle notes update
        )

        if updated_zone:
            return jsonify({
                'message': 'Zone updated successfully',
                'zone': {
                    'id': updated_zone.id,
                    'symbol': updated_zone.symbol,
                    'type': updated_zone.type,
                    'entry': updated_zone.entry,
                    'stoploss': updated_zone.stoploss,
                    'target': updated_zone.target,
                    'status': updated_zone.status,
                    'notes': updated_zone.notes,
                    'created_at': updated_zone.created_at.isoformat(),
                    'last_price': updated_zone.ticker.last_price if updated_zone.ticker else None
                }
            }), 200
        return jsonify({'error': 'Zone not found'}), 404

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
