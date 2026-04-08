describe('GithubService', () => {
  describe('repositoryExists', () => {
    it.todo(
      'should return true if GitHub API responds with 200 for a valid repository',
    );
    it.todo('should return false if GitHub API responds with 404');
    it.todo(
      'should throw an error if GitHub API returns an unexpected status code',
    );
    it.todo('should throw an error if the network request fails');
  });

  describe('getLatestRelease', () => {
    it.todo('should return the latest release tag for a repository');
    it.todo('should return null if the repository has no releases');
    it.todo(
      'should throw an error if GitHub API returns an unexpected status code',
    );
    it.todo('should throw an error if the network request fails');
  });
});
