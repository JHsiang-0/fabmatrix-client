import assert from 'node:assert/strict'
import test from 'node:test'
import {
  acquireJobActionLock,
  getJobActionKey,
  releaseJobActionLock
} from '../src/utils/jobAction.js'

test('JobQueue 写操作锁按 action+job 去重，并在释放后允许再次获取', () => {
  const state = { value: '' }

  assert.equal(getJobActionKey('pause', '1001'), 'pause:1001')
  assert.equal(acquireJobActionLock({ actionLoadingKey: state, action: 'pause', jobId: '1001' }), true)
  assert.equal(acquireJobActionLock({ actionLoadingKey: state, action: 'pause', jobId: '1001' }), false)
  assert.equal(acquireJobActionLock({ actionLoadingKey: state, action: 'resume', jobId: '1001' }), false)
  assert.equal(state.value, 'pause:1001')

  releaseJobActionLock({ actionLoadingKey: state, action: 'resume', jobId: '1001' })
  assert.equal(state.value, 'pause:1001')
  releaseJobActionLock({ actionLoadingKey: state, action: 'pause', jobId: '1001' })
  assert.equal(state.value, '')
  assert.equal(acquireJobActionLock({ actionLoadingKey: state, action: 'pause', jobId: '1001' }), true)
})
