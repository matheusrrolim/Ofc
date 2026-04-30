import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme.dart';
import '../widgets/tiles.dart';

class MatchResultScreen extends StatelessWidget {
  const MatchResultScreen({
    super.key,
    required this.match,
    required this.myClubId,
  });

  final MatchResult match;
  final String myClubId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Match result')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Container(
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppPalette.surface, AppPalette.surface2],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppPalette.border),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          match.homeName,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppPalette.text,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          '${match.homeGoals} : ${match.awayGoals}',
                          style: const TextStyle(
                            color: AppPalette.gold,
                            fontSize: 36,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          match.awayName,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppPalette.text,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${match.mode} · reward +${match.reward}',
                    style:
                        const TextStyle(color: AppPalette.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 2.4,
              children: [
                KpiCard(
                    label: 'Shots',
                    value:
                        '${match.homeStats.shots} – ${match.awayStats.shots}'),
                KpiCard(
                    label: 'On target',
                    value:
                        '${match.homeStats.onTarget} – ${match.awayStats.onTarget}'),
                KpiCard(
                    label: 'Possession',
                    value:
                        '${match.homeStats.possession}% – ${match.awayStats.possession}%'),
                KpiCard(
                    label: 'Chances',
                    value:
                        '${match.homeStats.chances} – ${match.awayStats.chances}'),
              ],
            ),
            const SectionTitle('Events'),
            for (final ev in match.events)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    SizedBox(
                      width: 36,
                      child: Text(
                        "${ev.minute}'",
                        style: const TextStyle(color: AppPalette.muted),
                      ),
                    ),
                    SizedBox(
                      width: 24,
                      child: Text(
                        ev.type == 'goal'
                            ? '⚽'
                            : ev.type == 'save'
                                ? '🧤'
                                : '↗',
                        style: TextStyle(
                          color: ev.type == 'goal'
                              ? AppPalette.green
                              : AppPalette.muted,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        '${ev.team.toUpperCase()} — ${ev.note}',
                        style: const TextStyle(
                            color: AppPalette.text, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }
}
