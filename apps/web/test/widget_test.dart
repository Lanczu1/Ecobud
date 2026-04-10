import 'package:ecobud_web/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders ECOBUD hero and transparency section', (tester) async {
    await tester.pumpWidget(const EcoBudWebApp());
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('Start Your Eco Journey'), findsOneWidget);
    expect(find.text('Public Transparency Ledger'), findsOneWidget);
  });
}
