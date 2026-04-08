describe('ScannerService', () => {
  describe('scan', () => {
    it.todo(
      'should fetch the latest release for each unique repository in active subscriptions',
    );
    it.todo(
      'should send a notification email to each subscriber when a new release is detected',
    );
    it.todo(
      'should update last_seen_tag in the database after sending notifications',
    );
    it.todo(
      'should not send a notification if the latest release matches last_seen_tag',
    );
    it.todo('should not send a notification if the repository has no releases');
    it.todo(
      'should continue processing remaining repos if one GitHub API call fails',
    );
    it.todo('should not send any emails if there are no active subscriptions');
  });
});
