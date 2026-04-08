describe('SubscriptionService', () => {
  describe('subscribe', () => {
    it.todo('should validate that the repository exists via githubService');
    it.todo('should save a new unconfirmed subscription to the database');
    it.todo('should generate a confirmation token and store it');
    it.todo('should call emailService to send a confirmation email');
    it.todo(
      'should throw RepositoryNotFoundError if githubService returns not found',
    );
    it.todo(
      'should throw DuplicateSubscriptionError if subscription already exists for email and repo',
    );
  });

  describe('confirm', () => {
    it.todo('should mark the subscription as confirmed in the database');
    it.todo('should throw TokenNotFoundError if the token does not exist');
    it.todo('should throw InvalidTokenError if the token format is invalid');
  });

  describe('unsubscribe', () => {
    it.todo('should remove the subscription from the database');
    it.todo('should throw TokenNotFoundError if the token does not exist');
    it.todo('should throw InvalidTokenError if the token format is invalid');
  });

  describe('getSubscriptions', () => {
    it.todo('should return all confirmed subscriptions for a given email');
    it.todo(
      'should return an empty array if no subscriptions exist for the email',
    );
  });
});
