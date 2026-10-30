const { build } = require('./package.json')
const repository = process.env.STUDIO_RELEASE_REPOSITORY || 'pierrelmy/mardown-studio'
if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
  throw new Error('STUDIO_RELEASE_REPOSITORY doit être owner/repo')
const [owner, repo] = repository.split('/')
const config = structuredClone(build)
config.mac.identity = '-'
config.mac.notarize = false
config.publish = [{ provider: 'github', owner, repo, releaseType: 'draft' }]
config.artifactName = '${productName}-${version}-${os}-${arch}.${ext}'
module.exports = config
