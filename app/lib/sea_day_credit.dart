double creditableDaysForSmallVessel(double hoursUnderway) {
  if (hoursUnderway < 4) {
    return 0;
  }

  return 1;
}
