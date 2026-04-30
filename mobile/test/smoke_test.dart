import 'package:flutter_test/flutter_test.dart';

import 'package:ofc/app.dart';

void main() {
  testWidgets('app boots without crashing', (tester) async {
    await tester.pumpWidget(const OfcApp());
    // The splash shows while bootstrap runs.
    expect(find.text('OFC Manager'), findsOneWidget);
  });
}
