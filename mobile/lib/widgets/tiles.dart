import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme.dart';

class RatingBadge extends StatelessWidget {
  const RatingBadge({super.key, required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppPalette.bg2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 14,
        ),
      ),
    );
  }
}

class PositionPill extends StatelessWidget {
  const PositionPill({super.key, required this.position});
  final String position;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppPalette.surface2,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        position,
        style: const TextStyle(
          color: AppPalette.accent,
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
      ),
    );
  }
}

class PlayerTile extends StatelessWidget {
  const PlayerTile({super.key, required this.player, this.trailing});
  final Player player;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            RatingBadge(
              label: player.overallRating.toString(),
              color: rarityColor(player.rarity),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    player.name,
                    style: const TextStyle(
                      color: AppPalette.text,
                      fontWeight: FontWeight.w700,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        '${player.nationality} · ${player.age}y',
                        style: const TextStyle(
                          color: AppPalette.muted,
                          fontSize: 12,
                        ),
                      ),
                      PositionPill(position: player.position),
                    ],
                  ),
                ],
              ),
            ),
            if (trailing != null) ...[
              const SizedBox(width: 8),
              trailing!,
            ],
          ],
        ),
      ),
    );
  }
}

class CoachTile extends StatelessWidget {
  const CoachTile({
    super.key,
    required this.coach,
    this.isActive = false,
    this.onSelect,
  });
  final Coach coach;
  final bool isActive;
  final VoidCallback? onSelect;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            RatingBadge(label: '★', color: rarityColor(coach.rarity)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isActive ? '${coach.name} · active' : coach.name,
                    style: const TextStyle(
                      color: AppPalette.text,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${coach.nationality} · TAC +${coach.bonuses.tacticalBoost}% · STA +${coach.bonuses.staminaBoost}% · CHE +${coach.bonuses.chemistryBoost}%',
                    style: const TextStyle(
                      color: AppPalette.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            if (!isActive && onSelect != null)
              FilledButton(
                onPressed: onSelect,
                child: const Text('Use'),
              ),
          ],
        ),
      ),
    );
  }
}

class KpiCard extends StatelessWidget {
  const KpiCard({super.key, required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(color: AppPalette.muted, fontSize: 12),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                color: AppPalette.text,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.action});
  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 14, 4, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: AppPalette.text,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          if (action != null) action!,
        ],
      ),
    );
  }
}
