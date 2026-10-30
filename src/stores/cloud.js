import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { cloudApi } from '@/api/cloud'
import { createCloudSession, createCloudState } from '@/utils/cloudSession'

export const useCloudStore = defineStore('cloud', () => {
  const state = reactive(createCloudState())
  return createCloudSession(cloudApi, state)
})
