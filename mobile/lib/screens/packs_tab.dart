import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/tiles.dart';
import 'pack_result_screen.dart';

class PacksTab extends StatefulWidget {
  const PacksTab({super.key});

  @override
  State<PacksTab> createState() => _PacksTabState();
}

class _PacksTabState extends State<PacksTab> {
  late Future<List<Pack>> _future;
  bool _opening = false;

  @override
  void initState() {
    super.initState();
    _future = context.read<AppState>().api.packs();
  }

  Future<void> _open(Pack pack, String currency) async {
    if (_opening) return;
    setState(() => _opening = true);
    final state = context.read<AppState>();
    try {
      final res = await state.api.openPack(pack.id, currency);
      await state.refreshMe();
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => PackResultScreen(result: res)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.decimalPattern();
    return FutureBuilder<List<Pack>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return Center(
            child: Text(snap.error.toString(),
                style: const TextStyle(color: AppPalette.muted)),
          );
        }
        final packs = snap.data!;
        return ListView(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
          children: [
            const SectionTitle('Packs'),
            for (final p in packs)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        RatingBadge(
                          label: '🎁',
                          color: rarityColor(p.tier == 'elite'
                              ? 'special'
                              : p.tier == 'premium'
                                  ? 'epic'
                                  : 'rare'),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p.name,
                                style: const TextStyle(
                                  color: AppPalette.text,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${p.playerCount} players · ${p.coachChance}% coach',
                                style: const TextStyle(
                                    color: AppPalette.muted, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Wrap(
                          direction: Axis.vertical,
                          spacing: 6,
                          children: [
                            if (p.priceSoft > 0)
                              ElevatedButton(
                                onPressed: _opening
                                    ? null
                                    : () => _open(p, 'soft'),
                                child: Text('⛁ ${fmt.format(p.priceSoft)}'),
                              ),
                            if (p.pricePremium > 0)
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppPalette.gold,
                                  foregroundColor: AppPalette.bg,
                                ),
                                onPressed: _opening
                                    ? null
                                    : () => _open(p, 'premium'),
                                child: Text('★ ${fmt.format(p.pricePremium)}'),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 12),
            const Text(
              'Packs are one of several progression paths — playing matches and trading on the market also earn rewards.',
              style: TextStyle(color: AppPalette.muted, fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ],
        );
      },
    );
  }
}
