describe('EmailService', () => {
  describe('sendConfirmationEmail', () => {
    it.todo(
      'should send an email with a confirmation link containing the token',
    );
    it.todo('should send to the correct recipient email address');
    it.todo('should throw an error if the mail transport fails');
  });

  describe('sendNotificationEmail', () => {
    it.todo(
      'should send a release notification email with the repo name and release tag',
    );
    it.todo('should include an unsubscribe link with the correct token');
    it.todo('should send to the correct recipient email address');
    it.todo('should throw an error if the mail transport fails');
  });
});
