import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/tiles.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  late Future<_HomeData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_HomeData> _load() async {
    final state = context.read<AppState>();
    await state.refreshMe();
    final api = state.api;
    final clubId = state.club!.id;
    final results = await Future.wait([
      api.standings(),
      api.missions(),
      api.recentMatches(clubId, limit: 5),
    ]);
    return _HomeData(
      standings: results[0] as List<StandingRow>,
      missions: results[1] as List<Mission>,
      recent: results[2] as List<MatchResult>,
    );
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final user = state.user;
    final club = state.club;
    if (user == null || club == null) return const SizedBox.shrink();

    return RefreshIndicator(
      onRefresh: () async {
        _refresh();
        await _future;
      },
      child: FutureBuilder<_HomeData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return _ErrorView(error: snap.error.toString(), onRetry: _refresh);
          }
          final data = snap.data!;
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
            children: [
              GridView.count(
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 2.4,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  KpiCard(label: 'Division', value: user.division),
                  KpiCard(label: 'Points', value: '${club.points}'),
                  KpiCard(
                    label: 'W-D-L',
                    value: '${club.wins}-${club.draws}-${club.losses}',
                  ),
                  KpiCard(
                    label: 'Chemistry',
                    value: '${club.chemistryScore}%',
                  ),
                ],
              ),
              const SectionTitle('Missions'),
              ...data.missions.map((m) => _MissionTile(
                    mission: m,
                    onClaim: () async {
                      try {
                        await state.api.claimMission(m.id);
                        await state.refreshMe();
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('+${m.reward} claimed')),
                        );
                        _refresh();
                      } catch (e) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(e.toString())),
                        );
                      }
                    },
                  )),
              const SectionTitle('Standings'),
              ...data.standings.take(8).map(_StandingTile.new),
              const SectionTitle('Recent matches'),
              if (data.recent.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(8),
                  child: Text('No matches yet.',
                      style: TextStyle(color: AppPalette.muted)),
                )
              else
                ...data.recent.map((m) => _RecentMatchTile(
                      match: m,
                      isHome: m.homeClubId == club.id,
                    )),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => state.logout(),
                  child: const Text('Logout'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _HomeData {
  _HomeData({required this.standings, required this.missions, required this.recent});
  final List<StandingRow> standings;
  final List<Mission> missions;
  final List<MatchResult> recent;
}

class _MissionTile extends StatelessWidget {
  const _MissionTile({required this.mission, required this.onClaim});
  final Mission mission;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) {
    final pct = (mission.progress / mission.goal).clamp(0.0, 1.0);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    mission.description,
                    style: const TextStyle(
                      color: AppPalette.text,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (mission.completed && !mission.claimed)
                  ElevatedButton(
                    onPressed: onClaim,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppPalette.gold,
                      foregroundColor: AppPalette.bg,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                    ),
                    child: Text('+${mission.reward}'),
                  )
                else
                  Text(
                    mission.claimed
                        ? 'claimed'
                        : '${(pct * 100).round()}%',
                    style: const TextStyle(color: AppPalette.muted),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: pct,
                minHeight: 6,
                backgroundColor: AppPalette.bg2,
                valueColor: const AlwaysStoppedAnimation(AppPalette.accent),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '${mission.progress}/${mission.goal} · ${mission.period}',
              style: const TextStyle(color: AppPalette.muted, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class _StandingTile extends StatelessWidget {
  const _StandingTile(this.row);
  final StandingRow row;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              RatingBadge(label: '${row.points}', color: AppPalette.accent),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      row.name + (row.isAI ? ' (AI)' : ''),
                      style: const TextStyle(
                        color: AppPalette.text,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'P:${row.played}  W:${row.wins}  D:${row.draws}  L:${row.losses}  GD:${row.goalDiff}',
                      style: const TextStyle(
                          color: AppPalette.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecentMatchTile extends StatelessWidget {
  const _RecentMatchTile({required this.match, required this.isHome});
  final MatchResult match;
  final bool isHome;

  @override
  Widget build(BuildContext context) {
    final myG = isHome ? match.homeGoals : match.awayGoals;
    final oppG = isHome ? match.awayGoals : match.homeGoals;
    final oppName = isHome ? match.awayName : match.homeName;
    final color = myG > oppG
        ? AppPalette.green
        : myG == oppG
            ? AppPalette.muted
            : AppPalette.red;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              RatingBadge(label: '$myG-$oppG', color: color),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      oppName,
                      style: const TextStyle(
                        color: AppPalette.text,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${match.mode} · ${DateFormat.yMd().add_Hm().format(match.playedAt)}',
                      style: const TextStyle(
                          color: AppPalette.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error, required this.onRetry});
  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 80),
        const Icon(Icons.error_outline, color: AppPalette.muted, size: 40),
        const SizedBox(height: 8),
        Text(
          error,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppPalette.muted),
        ),
        const SizedBox(height: 16),
        Center(
          child: OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ),
      ],
    );
  }
}
