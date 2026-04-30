import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/tiles.dart';

class SquadTab extends StatefulWidget {
  const SquadTab({super.key});

  @override
  State<SquadTab> createState() => _SquadTabState();
}

class _SquadTabState extends State<SquadTab> {
  late Future<_SquadData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_SquadData> _load() async {
    final state = context.read<AppState>();
    final clubId = state.club!.id;
    final results = await Future.wait([
      state.api.squad(clubId),
      state.api.coaches(clubId),
    ]);
    return _SquadData(
      squad: results[0] as SquadResponse,
      coaches: results[1] as List<Coach>,
    );
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {
        _refresh();
        await _future;
      },
      child: FutureBuilder<_SquadData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  snap.error.toString(),
                  style: const TextStyle(color: AppPalette.muted),
                ),
              ),
            );
          }
          final data = snap.data!;
          final groups = <String, List<Player>>{
            'GK': [],
            'DEF': [],
            'MID': [],
            'ATT': [],
          };
          for (final p in data.squad.players) {
            (groups[p.position] ?? groups['MID']!).add(p);
          }
          for (final l in groups.values) {
            l.sort((a, b) => b.overallRating.compareTo(a.overallRating));
          }

          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
            children: [
              _ChemistryCard(chem: data.squad.chemistry),
              if (data.squad.coach != null) ...[
                const SectionTitle('Manager'),
                CoachTile(coach: data.squad.coach!, isActive: true),
              ],
              if (data.coaches.length > 1) ...[
                const SectionTitle('Coaching staff'),
                ...data.coaches.map((c) {
                  final isActive = data.squad.coach?.id == c.id;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: CoachTile(
                      coach: c,
                      isActive: isActive,
                      onSelect: isActive
                          ? null
                          : () async {
                              try {
                                await context
                                    .read<AppState>()
                                    .api
                                    .setCoach(data.squad.club.id, c.id);
                                if (!mounted) return;
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                      content: Text('Coach assigned')),
                                );
                                _refresh();
                              } catch (e) {
                                if (!mounted) return;
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(e.toString())),
                                );
                              }
                            },
                    ),
                  );
                }),
              ],
              for (final pos in ['GK', 'DEF', 'MID', 'ATT'])
                if (groups[pos]!.isNotEmpty) ...[
                  SectionTitle('$pos (${groups[pos]!.length})'),
                  ...groups[pos]!.map((p) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: PlayerTile(
                          player: p,
                          trailing: p.onMarket
                              ? const Text(
                                  'on market',
                                  style: TextStyle(color: AppPalette.muted),
                                )
                              : FilledButton(
                                  onPressed: () => _promptSell(p),
                                  child: const Text('Sell'),
                                ),
                        ),
                      )),
                ],
            ],
          );
        },
      ),
    );
  }

  Future<void> _promptSell(Player p) async {
    final controller = TextEditingController();
    final price = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppPalette.surface,
        title: Text('Sell ${p.name}'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Price (soft currency)',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final n = int.tryParse(controller.text);
              if (n != null) Navigator.pop(ctx, n);
            },
            child: const Text('List'),
          ),
        ],
      ),
    );
    if (price == null) return;
    try {
      await context.read<AppState>().api.createListing(p.id, price);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Listed')),
      );
      _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }
}

class _SquadData {
  _SquadData({required this.squad, required this.coaches});
  final SquadResponse squad;
  final List<Coach> coaches;
}

class _ChemistryCard extends StatelessWidget {
  const _ChemistryCard({required this.chem});
  final ChemistryResult chem;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Chemistry',
                    style: TextStyle(
                      color: AppPalette.text,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Majority: ${chem.majorityNation.isEmpty ? '—' : chem.majorityNation} (${chem.majoritySize})',
                    style: const TextStyle(
                      color: AppPalette.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            RatingBadge(
              label: '${chem.totalBonus}%',
              color: AppPalette.gold,
            ),
          ],
        ),
      ),
    );
  }
}
