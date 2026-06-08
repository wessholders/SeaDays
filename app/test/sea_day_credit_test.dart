import 'package:flutter_test/flutter_test.dart';
import 'package:sea_days/sea_day_credit.dart';

void main() {
  test('credits zero days below four hours underway', () {
    expect(creditableDaysForSmallVessel(3.99), 0);
  });

  test('credits one day at four hours underway', () {
    expect(creditableDaysForSmallVessel(4), 1);
  });

  test('credits one day above four hours underway', () {
    expect(creditableDaysForSmallVessel(12), 1);
  });
}
