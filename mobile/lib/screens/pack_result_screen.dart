import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme.dart';
import '../widgets/tiles.dart';

class PackResultScreen extends StatelessWidget {
  const PackResultScreen({super.key, required this.result});
  final PackOpenResult result;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(result.pack.name)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Container(
              padding: const EdgeInsets.symmetric(vertical: 24),
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
                  const Text('🎉', style: TextStyle(fontSize: 48)),
                  const SizedBox(height: 8),
                  Text(
                    '${result.pack.name} opened',
                    style: const TextStyle(
                      color: AppPalette.text,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            if (result.coach != null) ...[
              const SectionTitle('Coach'),
              CoachTile(coach: result.coach!),
            ],
            const SectionTitle('Players'),
            for (final p in result.players)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: PlayerTile(
                  player: p,
                  trailing: Text(
                    p.rarity,
                    style: TextStyle(
                      color: rarityColor(p.rarity),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
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
