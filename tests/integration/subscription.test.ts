describe('POST /api/subscribe', () => {
  it.todo(
    'should return 200 and send a confirmation email with valid email and existing repository',
  );
  it.todo('should return 400 if email format is invalid');
  it.todo('should return 400 if repo does not match owner/repo format');
  it.todo('should return 404 if repository is not found on GitHub');
  it.todo(
    'should return 409 if email is already subscribed to this repository',
  );
});

describe('GET /api/confirm/:token', () => {
  it.todo('should return 200 and confirm the subscription with a valid token');
  it.todo('should return 400 if token format is invalid');
  it.todo('should return 404 if token is not found');
});

describe('GET /api/unsubscribe/:token', () => {
  it.todo('should return 200 and remove the subscription with a valid token');
  it.todo('should return 400 if token format is invalid');
  it.todo('should return 404 if token is not found');
});

describe('GET /api/subscriptions', () => {
  it.todo('should return 200 and an array of subscriptions for a given email');
  it.todo('should return 200 and an empty array if no subscriptions exist');
  it.todo('should return 400 if email query parameter is missing');
  it.todo('should return 400 if email format is invalid');
});
