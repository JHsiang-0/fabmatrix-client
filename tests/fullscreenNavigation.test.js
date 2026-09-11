import assert from 'node:assert/strict'
import test from 'node:test'
import { createFullscreenLeaveHandler } from '../src/utils/fullscreenNavigation.js'

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

test('全屏退出等待导航，守卫取消时不退出全屏并恢复 leaving', async () => {
  const navigation = deferred()
  const aborted = { type: 'aborted' }
  let navigateCount = 0
  let exitCount = 0
  const handler = createFullscreenLeaveHandler({
    navigate: () => {
      navigateCount += 1
      return navigation.promise
    },
    isNavigationFailure: result => result === aborted,
    exitFullscreen: async () => { exitCount += 1 }
  })

  const firstLeave = handler.leave()
  assert.equal(handler.isLeaving(), true)
  assert.equal(await handler.leave(), false)
  assert.equal(navigateCount, 1)
  assert.equal(exitCount, 0)
  navigation.resolve(aborted)
  assert.equal(await firstLeave, false)
  assert.equal(handler.isLeaving(), false)
  assert.equal(exitCount, 0)
})

test('全屏退出仅在导航成功后执行，导航异常会恢复 leaving', async () => {
  let exitCount = 0
  const errors = []
  const failed = createFullscreenLeaveHandler({
    navigate: async () => { throw new Error('navigation failed') },
    isNavigationFailure: () => false,
    exitFullscreen: async () => { exitCount += 1 },
    onError: error => errors.push(error.message)
  })
  assert.equal(await failed.leave(), false)
  assert.equal(failed.isLeaving(), false)
  assert.deepEqual(errors, ['navigation failed'])
  assert.equal(exitCount, 0)

  const succeeded = createFullscreenLeaveHandler({
    navigate: async () => undefined,
    isNavigationFailure: () => false,
    exitFullscreen: async () => { exitCount += 1 }
  })
  assert.equal(await succeeded.leave(), true)
  assert.equal(exitCount, 1)
})
