describe('SubscriptionController', () => {
  describe('subscribe', () => {
    it.todo(
      'should call subscriptionService.subscribe with email and repo from request body',
    );
    it.todo('should return 200 on successful subscription');
    it.todo('should return 400 if email is missing from request body');
    it.todo('should return 400 if repo is missing from request body');
    it.todo('should return 400 if email format is invalid');
    it.todo('should return 400 if repo does not match owner/repo format');
    it.todo(
      'should return 404 if subscriptionService throws a RepositoryNotFoundError',
    );
    it.todo(
      'should return 409 if subscriptionService throws a DuplicateSubscriptionError',
    );
  });

  describe('confirmSubscription', () => {
    it.todo(
      'should call subscriptionService.confirm with token from request params',
    );
    it.todo('should return 200 on successful confirmation');
    it.todo('should return 400 if token format is invalid');
    it.todo(
      'should return 404 if subscriptionService throws a TokenNotFoundError',
    );
  });

  describe('unsubscribe', () => {
    it.todo(
      'should call subscriptionService.unsubscribe with token from request params',
    );
    it.todo('should return 200 on successful unsubscription');
    it.todo('should return 400 if token format is invalid');
    it.todo(
      'should return 404 if subscriptionService throws a TokenNotFoundError',
    );
  });

  describe('getSubscriptions', () => {
    it.todo(
      'should call subscriptionService.getSubscriptions with email from query params',
    );
    it.todo('should return 200 and an array of subscriptions');
    it.todo('should return 200 and an empty array if no subscriptions found');
    it.todo('should return 400 if email query param is missing');
    it.todo('should return 400 if email format is invalid');
  });
});
