<template>
  <div class="app-page-shell app-page-background file-library-page">
    <PageHeader
      class="file-library-page-toolbar"
      title="文件库"
      description="管理可见的切片文件与目录，选择文件后可直接创建打印任务。"
    >
      <template #actions>
      <t-space class="file-library-toolbar__actions" size="small" align="center" break-line>
        <t-space class="file-view-toggle">
          <t-button variant="text" size="small" @click="viewMode = 'grid'"
            :class="{ 'file-view-toggle__active': viewMode === 'grid' }" aria-label="网格视图">
            <Grid />
          </t-button>
          <t-button variant="text" size="small" @click="viewMode = 'list'"
            :class="{ 'file-view-toggle__active': viewMode === 'list' }" aria-label="列表视图">
            <List />
          </t-button>
        </t-space>
        <t-button variant="outline" theme="default" size="medium" :icon="renderIcon(FolderOpened)" @click="openCreateFolderDialog">
          新建文件夹
        </t-button>
        <t-button theme="primary" size="medium" :icon="renderIcon(Upload)" @click="handleUpload">
          上传 G-Code 文件
        </t-button>
        <t-button v-if="isBatchMode && selectedIds.length > 0" theme="danger" size="medium" :icon="renderIcon(Delete)"
          :loading="batchDeleting" :disabled="batchDeleting || deletingIds.length > 0" @click="handleBatchDelete">
          批量删除 ({{ selectedIds.length }})
        </t-button>
        <t-button :icon="renderIcon(Refresh)" :loading="loading || treeLoading" :disabled="batchDeleting || deletingIds.length > 0" @click="refreshLibrary" size="medium">
          刷新
        </t-button>
      </t-space>
      </template>
    </PageHeader>

    <DataRegion class="file-library-workspace" label="文件工作台">
      <div class="file-library-layout">
        <aside class="file-library-sidebar" aria-label="文件目录">
          <div class="file-library-panel-heading">
            <div>
              <h2>目录</h2>
              <p>按目录定位文件，内容在右侧工作区展示</p>
            </div>
            <t-button variant="text" size="small" :loading="treeLoading" @click="loadFileTree">
              刷新
            </t-button>
          </div>
          <div class="file-library-tree app-scroll-region">
            <AsyncState
              v-if="treeLoading || treeError"
              :loading="treeLoading"
              :error="treeError"
              @retry="loadFileTree"
            />
            <t-empty v-else-if="fileTree.length === 0" description="暂无可见文件夹">
              <template #operation>
                <t-space>
                  <t-button size="small" variant="outline" @click="openCreateFolderDialog">新建文件夹</t-button>
                  <t-button size="small" theme="primary" @click="handleUpload">上传文件</t-button>
                </t-space>
              </template>
            </t-empty>
            <t-tree
              v-else
              :data="fileTree"
              activable
              hover
              :expand-level="1"
              @click="handleTreeClick"
            />
          </div>
        </aside>

        <section class="file-library-main" aria-labelledby="file-library-results-title">
          <QueryToolbar class="file-library-filter-row" label="文件筛选条件">
            <div class="file-library-navigation">
              <span class="file-library-section-label">当前位置</span>
              <t-breadcrumb separator="/">
                <t-breadcrumb-item :to="{ path: '' }" @click.prevent="navigateToRoot">
                  <span><folder-opened /></span>
                  <span>根目录</span>
                </t-breadcrumb-item>
                <t-breadcrumb-item
                  v-for="(breadcrumb, index) in breadcrumbs"
                  :key="breadcrumb.id"
                  @click.prevent="navigateTo(index)"
                >
                  {{ breadcrumb.name }}
                </t-breadcrumb-item>
              </t-breadcrumb>
            </div>
            <div class="file-library-toolbar__filters">
              <t-radio-group v-model="isBatchMode" variant="default-filled" size="small" aria-label="文件操作模式">
                <t-radio-button :value="false">浏览详情</t-radio-button>
                <t-radio-button :value="true">批量选择</t-radio-button>
              </t-radio-group>
              <t-input v-model="searchKeyword" placeholder="搜索文件名..." clearable size="medium"
                @keyup.enter="handleSearch">
                <template #prefixIcon>
                  <Search />
                </template>
              </t-input>
              <t-input v-model="materialFilter" placeholder="材质筛选" clearable size="medium"
                @keyup.enter="handleSearch">
              </t-input>
              <t-space class="file-library-filter-actions" size="small">
                <t-button theme="primary" size="medium" :loading="loading" @click="handleSearch">
                  查询
                </t-button>
                <t-button variant="outline" size="medium" :disabled="loading" @click="resetSearch">
                  重置
                </t-button>
              </t-space>
            </div>
          </QueryToolbar>

          <div class="file-library-results">
            <div class="file-library-results-heading">
              <div>
                <h2 id="file-library-results-title">{{ currentParentId ? '目录内容' : '根目录文件' }}</h2>
                <span>{{ fileList.length }} 项结果</span>
              </div>
              <t-tag v-if="isBatchMode" theme="primary" variant="light">批量选择模式</t-tag>
            </div>

            <AsyncState
              v-if="loading || loadError"
              :loading="loading"
              :error="loadError"
              @retry="fetchData"
            />
            <t-empty v-else-if="fileList.length === 0" description="当前目录暂无文件或文件夹">
              <template #operation>
                <t-space>
                  <t-button size="small" variant="outline" @click="openCreateFolderDialog">新建文件夹</t-button>
                  <t-button size="small" theme="primary" @click="handleUpload">上传 G-Code 文件</t-button>
                </t-space>
              </template>
            </t-empty>
            <t-alert v-if="loadError && fileList.length" theme="error" :close-btn="false" class="mb-3">
              <template #default>{{ loadError }}</template>
              <template #operation>
                <t-button size="small" variant="outline" @click="fetchData">重试</t-button>
              </template>
            </t-alert>
            <div v-if="fileList.length" class="file-library-list">
      <!-- 网格视图 -->
      <div v-if="viewMode === 'grid'" class="file-grid-view app-scroll-region">
        <!-- 文件夹 -->
        <div
          v-for="file in folderList"
          :key="file.id"
          class="file-card"
          :class="{ 'file-card--selected': isBatchMode && selectedIds.includes(file.id) }"
          @click="handleFileClick(file)"
        >
          <!-- 卡片选中状态 -->
          <div v-if="isBatchMode" class="file-card__selection">
            <t-checkbox :checked="selectedIds.includes(file.id)" disabled
              @click.stop="toggleSelection(file.id)"
              size="small" />
          </div>

          <!-- 文件夹图标 -->
          <div class="file-card__media file-card__media--folder">
            <IconFolder :size="64" />
          </div>

          <!-- 卡片内容 -->
          <div class="file-card__body">
            <h3 class="file-card__name"
              :title="file.originalName">
              {{ file.originalName }}
            </h3>

            <!-- 文件夹统计 -->
            <div class="file-card__stats">
              <div class="file-card__stat">
                <span class="file-card__stat-label">类型</span>
                <span class="file-card__stat-value">文件夹</span>
              </div>
            </div>

            <!-- 悬浮操作按钮 -->
            <div class="file-card__actions">
              <t-button theme="primary" size="small" :icon="renderIcon(FolderOpened)" @click.stop="navigateToFolder(file)"
                class="file-card__action">
                打开
              </t-button>
              <t-button theme="danger" size="small" :icon="renderIcon(Delete)" :loading="deletingIds.includes(file.id)"
                :disabled="batchDeleting || deletingIds.length > 0" @click.stop="handleDelete(file.id)"
                class="file-card__action">
                删除
              </t-button>
            </div>
          </div>
        </div>

        <!-- 文件 -->
        <div
          v-for="file in fileItemsList"
          :key="file.id"
          class="file-card"
          :class="{ 'file-card--selected': isBatchMode && selectedIds.includes(file.id) }"
          @click="handleFileClick(file)">
          <!-- 卡片选中状态 -->
          <div v-if="isBatchMode" class="file-card__selection">
            <t-checkbox :checked="selectedIds.includes(file.id)" @click.stop="toggleSelection(file.id)"
              size="small" />
          </div>

          <!-- 缩略图区域 -->
          <div class="file-card__media">
            <t-image v-if="file.thumbnailUrl" :src="file.thumbnailUrl" :alt="file.originalName" fit="cover"
              class="file-card__thumbnail">
              <template #error>
                <div class="file-card__media-placeholder">
                  <Picture :size="36" />
                  <span>加载失败</span>
                </div>
              </template>
            </t-image>
            <div v-else class="file-card__media-placeholder">
              <Document :size="36" />
              <span>NO IMAGE</span>
            </div>
            <!-- 材质标签 -->
            <t-tag :theme="getMaterialTagType(file.materialType)" class="file-card__material-tag" size="small">
              {{ file.materialType || '未指定' }}
            </t-tag>
          </div>

          <!-- 卡片内容 -->
          <div class="file-card__body">
            <h3 class="file-card__name"
              :title="file.originalName">
              {{ file.originalName }}
            </h3>

            <!-- 核心数据指标 -->
            <div class="file-card__metrics">
              <div>
                <Clock :size="14" class="file-card__metric-icon" />
                <span>{{ formatDuration(file.estTime) }}</span>
              </div>
              <div>
                <ScaleToOriginal :size="14" class="file-card__metric-icon" />
                <span>{{ formatMetric(file.filamentWeight, 'g') }}</span>
              </div>
              <div>
                <FullScreen :size="14" class="file-card__metric-icon" />
                <span>{{ formatMetric(file.filamentLength, 'm') }}</span>
              </div>
              <div>
                <span>{{ formatFileSize(file.fileSize) }}</span>
              </div>
            </div>

            <!-- 统计信息 -->
            <div class="file-card__stats">
              <div>
                <span class="file-card__stat-label">打印</span>
                <span class="file-card__stat-value">{{ formatMetric(file.printCount, '次') }}</span>
              </div>
              <div class="file-card__success-rate">
                <span class="file-card__stat-label">成功率</span>
                <t-progress v-if="hasValue(file.successRate)" :percentage="file.successRate" :stroke-width="4" :label="false"
                  :class="['file-card__success-rate-progress', getSuccessRateClass(file.successRate)]" />
                <span class="file-card__stat-value">{{ formatMetric(file.successRate, '%') }}</span>
              </div>
            </div>

            <!-- 悬浮操作按钮 -->
            <div class="file-card__actions">
              <t-button variant="text" size="small" @click.stop="openFileDetail(file)"
                class="file-card__action">
                详情
              </t-button>
              <t-button theme="primary" size="small" :icon="renderIcon(Printer)" @click.stop="handlePrint(file)"
                class="file-card__action">
                打印
              </t-button>
              <t-button theme="danger" size="small" :icon="renderIcon(Delete)" @click.stop="handleDelete(file.id)"
                class="file-card__action">
                删除
              </t-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-else class="file-table-view">
        <TdTable :data="fileRows" row-key="id" :loading="loading" height="100%" @selection-change="handleSelectionChange"
          @row-click="handleTableRowClick" border stripe style="width: 100%">
          <TdTableColumn v-if="isBatchMode" type="selection" width="50" align="center" />

          <TdTableColumn prop="originalName" label="文件名" min-width="200">
            <template #default="{ row }">
              <div class="file-table__name-cell">
                <div class="file-table__icon">
                  <span v-if="row.folder" class="file-table__folder-icon">
                    <IconFolder />
                  </span>
                  <t-image v-else-if="row.thumbnailUrl" :src="row.thumbnailUrl" fit="cover" class="file-table__thumbnail" />
                  <span v-else class="file-table__file-icon">
                    <Document />
                  </span>
                </div>
                <span class="file-table__name"
                  :title="row.originalName">{{
                    row.originalName
                  }}</span>
                <t-tag v-if="row.folder" size="small" class="file-table__type-tag">
                  文件夹
                </t-tag>
                <t-tag v-else :theme="getMaterialTagType(row.materialType)" size="small" class="file-table__type-tag">
                  {{ row.materialType || '未指定' }}
                </t-tag>
              </div>
            </template>
          </TdTableColumn>

          <TdTableColumn prop="fileSize" label="文件大小" width="100" v-if="currentParentId">
            <template #default="{ row }">{{ row.folder ? '-' : formatFileSize(row.fileSize) }}</template>
          </TdTableColumn>

          <TdTableColumn prop="estTime" label="预计耗时" width="85" v-if="currentParentId">
            <template #default="{ row }">{{ row.folder ? '文件夹' : formatDuration(row.estTime) }}</template>
          </TdTableColumn>

          <TdTableColumn prop="filamentWeight" label="耗材重量" width="85" v-if="currentParentId">
            <template #default="{ row }">{{
              row.folder ? '-' : formatMetric(row.filamentWeight, 'g')
              }}</template>
          </TdTableColumn>

          <TdTableColumn prop="filamentLength" label="所需线长" width="85" v-if="currentParentId">
            <template #default="{ row }">{{
              row.folder ? '-' : formatMetric(row.filamentLength, 'm')
              }}</template>
          </TdTableColumn>

          <TdTableColumn prop="printCount" label="打印次数" width="80" v-if="currentParentId">
            <template #default="{ row }">{{ row.folder ? '-' : formatMetric(row.printCount, '次') }}</template>
          </TdTableColumn>

          <TdTableColumn prop="successRate" label="成功率" width="100" v-if="currentParentId">
            <template #default="{ row }">
              <div class="file-table__rate" v-if="!row.folder && hasValue(row.successRate)">
                <t-progress :percentage="row.successRate" :stroke-width="6" :label="false"
                  :class="getSuccessRateClass(row.successRate)" />
                <span>{{ formatMetric(row.successRate, '%') }}</span>
              </div>
              <span v-else>-</span>
            </template>
          </TdTableColumn>

          <TdTableColumn label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <div class="file-table__actions">
                <t-button v-if="row.folder" theme="primary" size="small" :icon="renderIcon(FolderOpened)" @click.stop="navigateToFolder(row)">
                  打开
                </t-button>
                <template v-else>
                  <t-button variant="text" size="small" @click.stop="openFileDetail(row)">
                    详情
                  </t-button>
                  <t-button theme="primary" size="small" :icon="renderIcon(Printer)" @click.stop="handlePrint(row)">
                    打印
                  </t-button>
                </template>
                <t-button theme="danger" size="small" :icon="renderIcon(Delete)" :loading="deletingIds.includes(row.id)"
                  :disabled="batchDeleting || deletingIds.length > 0" @click.stop="handleDelete(row.id)">
                  删除
                </t-button>
              </div>
            </template>
          </TdTableColumn>
        </TdTable>
            </div>
          </div>

          <div v-if="fileList.length > 0" class="file-library-pagination">
            <t-pagination v-model:current="pagination.pageNum" v-model:pageSize="pagination.pageSize"
              :total="pagination.total" :show-page-size="false"
              @change="handlePageChange" />
          </div>
          </div>
        </section>
      </div>
    </DataRegion>

    <!-- 文件上传对话框 -->
    <t-dialog v-model:visible="uploadDialogVisible" header="批量上传切片文件" width="600px" :footer="false">
      <t-upload theme="custom" draggable multiple :auto-upload="false" accept=".gcode,.g,.3mf,.stl"
        @select-change="handleFileSelect" class="p-4">
        <span class="farm-icon--upload">
          <UploadFilled />
        </span>
        <div class="farm-upload__text">
          拖拽多个切片文件到此处 或 <em>点击上传</em>
        </div>
        <template #tips>
          <div class="farm-upload__tip">
            支持 .gcode、.g、.3mf、.stl 格式，单次最多 100 个、总大小不超过 250MB
          </div>
        </template>
      </t-upload>
      <div v-if="pendingUploadFiles.length" class="px-4 pb-4 space-y-3">
        <div class="text-sm text-gray-600">待上传文件（{{ pendingUploadFiles.length }}）</div>
        <div v-for="file in pendingUploadFiles" :key="`${file.name}-${file.lastModified}`"
          class="flex items-center justify-between gap-3 text-sm">
          <span class="min-w-0 truncate" :title="file.name">{{ file.name }}</span>
          <span class="shrink-0 text-gray-500">{{ batchUploading ? `${uploadProgress}%` : '待上传' }}</span>
        </div>
        <t-progress v-if="batchUploading" :percentage="uploadProgress" />
        <div class="flex justify-end gap-2">
          <t-button variant="outline" :disabled="batchUploading" @click="handleUpload">重新选择</t-button>
          <t-button variant="outline" :disabled="!batchUploading" @click="cancelUpload">取消上传</t-button>
          <t-button theme="primary" :loading="batchUploading" @click="submitBatchUpload">开始上传</t-button>
        </div>
      </div>
      <div v-if="batchUploadResults.length" class="px-4 pb-4 space-y-2">
        <t-alert
          :theme="batchUploadResults.every(isBatchUploadSuccess) ? 'success' : 'warning'"
          :title="batchUploadResults.every(isBatchUploadSuccess) ? '全部文件上传成功' : '部分文件未上传成功'"
          :close-btn="false"
        />
        <div v-for="result in batchUploadResults" :key="`${result.index}-${result.fileName}`"
          class="flex items-center justify-between gap-3 text-sm">
          <span class="min-w-0 truncate" :title="result.fileName">{{ result.fileName || `第 ${result.index + 1} 项` }}</span>
          <span :class="isBatchUploadSuccess(result) ? 'text-green-600' : 'text-red-600'">
            {{ isBatchUploadSuccess(result) ? '成功' : (result.message || '失败') }}
          </span>
        </div>
        <t-button v-if="pendingUploadFiles.length" size="small" theme="primary" @click="submitBatchUpload">
          重试可重试失败项（{{ pendingUploadFiles.length }}）
        </t-button>
      </div>
      <div v-if="uploadError" class="px-4 pb-4">
        <t-alert theme="error" :title="uploadError" :close-btn="false" />
      </div>
    </t-dialog>

    <!-- 新建文件夹对话框 -->
    <t-dialog v-model:visible="createFolderDialogVisible" header="新建文件夹" width="400px">
      <t-form :data="folderForm" :rules="folderRules" ref="folderFormRef" label-width="80px">
        <t-form-item label="文件夹名称" name="name">
          <t-input v-model="folderForm.name" placeholder="请输入文件夹名称" />
        </t-form-item>
      </t-form>

      <template #footer>
        <div class="flex justify-end gap-3">
          <t-button @click="createFolderDialogVisible = false">取消</t-button>
          <t-button theme="primary" @click="handleCreateFolder" :loading="creatingFolder">
            创建
          </t-button>
        </div>
      </template>
    </t-dialog>

    <!-- 文件详情抽屉 -->
    <FileDetailDrawer
      v-model="detailDrawerVisible"
      :file="selectedFile"
      :loading="detailLoading"
      :error="detailError"
      :jobs="detailJobs"
      :jobs-loading="detailJobsLoading"
      :jobs-error="detailJobsError"
      @download="handleFileDownload"
      @closed="closeFileDetail"
      @print="handlePrintFromDetail"
      @retry="retryFileDetail"
      @retry-jobs="retryFileJobs"
    />

    <!-- 创建打印任务对话框 -->
    <t-dialog v-model:visible="createJobDialogVisible" header="创建打印任务"
      width="480px"
      :close-on-overlay-click="false"
      :close-on-esc-keydown="true"
    >
      <div class="create-job-form">
        <!-- 文件信息展示 -->
        <div class="bg-gray-50 rounded-lg p-4 mb-5">
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 rounded border border-gray-200 overflow-hidden bg-white flex-shrink-0">
              <t-image
                v-if="jobForm.file?.thumbnailUrl"
                :src="jobForm.file?.thumbnailUrl"
                fit="cover"
                class="w-full h-full"
              >
                <template #error>
                  <div class="w-full h-full flex items-center justify-center text-gray-400">
                    <span><Document /></span>
                  </div>
                </template>
              </t-image>
              <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                <span><Document /></span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-gray-500 mb-1">当前选中文件</div>
              <div class="text-base font-semibold text-gray-900 truncate" :title="jobForm.file?.originalName">
                {{ jobForm.file?.originalName }}
              </div>
            </div>
          </div>
        </div>

        <!-- 表单区域 -->
        <t-form :data="jobForm" label-width="90px" size="medium">
          <!-- 任务优先级 -->
          <t-form-item label="任务优先级">
            <t-radio-group v-model="jobForm.priority">
              <t-radio :value="0">
                <span class="text-gray-700">普通</span>
              </t-radio>
              <t-radio :value="50">
                <span class="text-yellow-600">优先</span>
              </t-radio>
              <t-radio :value="100">
                <span class="text-red-600">加急</span>
              </t-radio>
            </t-radio-group>
          </t-form-item>

          <t-form-item label="打印机">
            <t-select v-model="jobForm.printerId" placeholder="不指定，创建后进入队列" clearable :loading="loadingPrinters">
              <t-option label="不指定（进入队列）" value="" />
              <t-option
                v-for="printer in availablePrinters"
                :key="printer.id"
                :label="`${printer.name}（${printer.machineNumber || `#${printer.id}`}）`"
                :value="printer.id"
              />
            </t-select>
            <div class="text-xs text-gray-500 mt-1">指定打印机只记录分配目标，不会跳过安全确认流程</div>
          </t-form-item>

          <!-- 打印份数 -->
          <t-form-item label="打印份数">
            <t-input-number
              v-model="jobForm.copies"
              :min="1"
              :max="99"
              :step="1"

              class="w-full"
            />
            <div class="text-xs text-gray-500 mt-1">将为同一文件创建多个排队任务</div>
          </t-form-item>
        </t-form>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <t-button @click="createJobDialogVisible = false">取消</t-button>
          <t-button theme="primary" @click="handleSubmitCreateJob" :loading="submittingJob">
            确认提交
          </t-button>
        </div>
      </template>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { message, confirmMessage } from '@/utils/message'
import { renderIcon } from '@/utils/tdesign'
import {
  SearchIcon as Search,
  RefreshIcon as Refresh,
  DeleteIcon as Delete,
  CloudUploadIcon as UploadFilled,
  ImageIcon as Picture,
  FileIcon as Document,
  ZoomInIcon as ScaleToOriginal,
  FullscreenIcon as FullScreen,
  TimeIcon as Clock,
  FolderOpenIcon as FolderOpened,
  GridViewIcon as Grid,
  ViewListIcon as List,
  PrintIcon as Printer,
  UploadIcon as Upload
} from 'tdesign-icons-vue-next'
import {
  getFileList,
  uploadFile as uploadPrintFile,
  deleteFile,
  deleteBatchFiles,
  downloadFile,
  createFolder,
  getFilePreview,
  getThumbnailUrl,
  getFileJobs,
  getFileTree,
  batchUploadFiles
} from '@/api/printFile'
import { createPrintJob } from '@/api/job'
import { getPrinterList } from '@/api/printer'
import { formatDuration, formatFileSize } from '@/utils/formatters'
import FileDetailDrawer from '@/components/file/FileDetailDrawer.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import QueryToolbar from '@/components/layout/QueryToolbar.vue'
import DataRegion from '@/components/layout/DataRegion.vue'
import IconFolder from '@/components/icons/IconFolder.vue'
import AsyncState from '@/components/AsyncState.vue'
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'
import {
  isBatchUploadSuccess,
  normalizeBatchUploadResult,
  validateBatchUploadSelection
} from '@/utils/batchUpload'
import { chunkItems, runUploadQueue } from '@/utils/uploadQueue'

defineOptions({ name: 'FileLibrary' })

// ============ 状态定义 ============
const loading = ref(false)
const loadError = ref('')
const fileList = ref([])
const treeLoading = ref(false)
const treeError = ref('')
const fileTree = ref([])
const selectedIds = ref([])
const searchKeyword = ref('')
const materialFilter = ref('')
// 材质筛选使用后端 PrintFileQueryDTO 的 materialType 精确筛选。
const viewMode = ref('list')
const uploadDialogVisible = ref(false)
const createFolderDialogVisible = ref(false)
const creatingFolder = ref(false)
const pendingUploadFiles = ref([])
const batchUploadResults = ref([])
const batchUploading = ref(false)
const batchDeleting = ref(false)
const deletingIds = ref([])
const uploadProgress = ref(0)
const uploadError = ref('')
const UPLOAD_BATCH_SIZE = 5
let uploadController = null
// 打印任务对话框状态
const createJobDialogVisible = ref(false)
const submittingJob = ref(false)
const availablePrinters = ref([])
const loadingPrinters = ref(false)
const jobForm = reactive({
  file: null,
  printerId: '',
  priority: 0, // 0-普通, 50-优先, 100-加急
  copies: 1
})

// 文件详情抽屉状态
const detailDrawerVisible = ref(false)
const selectedFile = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
const detailJobs = ref([])
const detailJobsLoading = ref(false)
const detailJobsError = ref('')
const FILE_DETAIL_CONTEXT_KEY = 'farm-ui:file-detail'
// 批量操作模式
const isBatchMode = ref(false)

watch(isBatchMode, enabled => {
  if (!enabled) selectedIds.value = []
})

// 文件夹导航状态
const currentParentId = ref(null)
const breadcrumbs = ref([])

// 新建文件夹表单
const folderForm = reactive({
  name: ''
})

const folderRules = {
  name: [
    { required: true, message: '请输入文件夹名称', trigger: 'blur' },
    { min: 1, max: 50, message: '文件夹名称长度在 1 到 50 个字符之间', trigger: 'blur' }
  ]
}

const folderFormRef = ref(null)

// 分页状态
const pagination = reactive({
  pageNum: 1,
  pageSize: 12,
  total: 0
})

// 计算文件夹和文件列表
const fileRows = computed(() => fileList.value.map(file => ({
  ...file,
  viewType: file.folder ? 'folder' : 'file'
})))

const folderList = computed(() => fileRows.value.filter(file => file.viewType === 'folder'))

const fileItemsList = computed(() => fileRows.value.filter(file => file.viewType === 'file'))

const hasValue = value => value !== undefined && value !== null && value !== ''

const formatMetric = (value, suffix = '') => hasValue(value) ? `${value}${suffix}` : '-'

/**
 * 将完整 FileNodeVO 树裁剪为目录导航树。
 * 文件节点仍由当前目录的分页接口承载，不能在左侧目录中再次展示。
 */
const normalizeTreeNode = node => {
  if (!node || node.folder !== true) return null

  return {
    value: String(node.id),
    label: node.name,
    name: node.name,
    folder: true,
    id: node.id,
    parentId: node.parentId ?? null,
    children: Array.isArray(node.children)
      ? node.children.map(normalizeTreeNode).filter(Boolean)
      : []
  }
}

const restoreFileDetailContext = () => {
  const fileId = sessionStorage.getItem(FILE_DETAIL_CONTEXT_KEY)
  if (!fileId || selectedFile.value) return

  const file = fileList.value.find(item => String(item.id) === fileId)
  if (file) openFileDetail(file)
}

// ============ 方法定义 ============

/**
 * 获取文件列表
 */
const fetchData = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const params = {
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      fileName: searchKeyword.value || undefined,
      materialType: materialFilter.value || undefined,
      parentId: currentParentId.value
    }
    const res = await getFileList(params)
    fileList.value = res.data?.records || []
    pagination.total = res.data?.total || 0

    // 清空选中状态（如果当前页数据变化）
    selectedIds.value = []
    restoreFileDetailContext()
  } catch (error) {
    console.error('获取文件列表失败:', error)
    loadError.value = error?.message || '文件列表加载失败，请重试'
    message.error('获取文件列表失败')
  } finally {
    loading.value = false
  }
}

const loadFileTree = async () => {
  treeLoading.value = true
  treeError.value = ''
  try {
    const response = await getFileTree()
    fileTree.value = (Array.isArray(response.data) ? response.data : [])
      .map(normalizeTreeNode)
      .filter(Boolean)
  } catch (error) {
    console.error('获取文件目录树失败:', error)
    treeError.value = error?.message || '目录树加载失败，请重试'
    message.error('获取文件目录树失败')
  } finally {
    treeLoading.value = false
  }
}

const refreshLibrary = () => Promise.all([fetchData(), loadFileTree()])

/**
 * 导航到根目录
 */
const navigateToRoot = () => {
  currentParentId.value = null
  breadcrumbs.value = []
  pagination.pageNum = 1
  fetchData()
}

/**
 * 导航到指定文件夹
 */
const navigateToFolder = (folder) => {
  currentParentId.value = folder.id
  breadcrumbs.value.push({
    id: folder.id,
    name: folder.originalName
  })
  pagination.pageNum = 1
  fetchData()
}

/**
 * 导航到面包屑指定位置
 */
const navigateTo = (index) => {
  breadcrumbs.value = breadcrumbs.value.slice(0, index + 1)
  currentParentId.value = breadcrumbs.value[index]?.id || null
  pagination.pageNum = 1
  fetchData()
}

const handleTreeClick = ({ node }) => {
  if (!node?.data?.folder) return

  const path = typeof node.getPath === 'function' ? node.getPath() : []
  breadcrumbs.value = path
    .filter(pathNode => pathNode.data?.folder)
    .map(pathNode => ({
      id: pathNode.data.id,
      name: pathNode.data.label || pathNode.data.name
    }))
  currentParentId.value = node.data.id
  pagination.pageNum = 1
  fetchData()
}

/**
 * 打开新建文件夹对话框
 */
const openCreateFolderDialog = () => {
  folderForm.name = ''
  createFolderDialogVisible.value = true
}

/**
 * 创建文件夹
 */
const handleCreateFolder = async () => {
  await folderFormRef.value?.validate()
  creatingFolder.value = true

  try {
    await createFolder({
      parentId: currentParentId.value,
      folderName: folderForm.name
    })
    message.success('文件夹创建成功')
    createFolderDialogVisible.value = false
    await refreshLibrary()
  } catch (error) {
    console.error('创建文件夹失败:', error)
    message.error('创建文件夹失败')
  } finally {
    creatingFolder.value = false
  }
}

/**
 * 搜索处理
 */
const handleSearch = () => {
  pagination.pageNum = 1
  fetchData()
}

const resetSearch = () => {
  searchKeyword.value = ''
  materialFilter.value = ''
  selectedIds.value = []
  pagination.pageNum = 1
  fetchData()
}

/**
 * 页码变化
 */
const handlePageChange = ({ current, pageSize }) => {
  pagination.pageNum = current
  pagination.pageSize = pageSize
  fetchData()
}

/**
 * 切换选中状态
 */
const toggleSelection = (id) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

/**
 * 列表视图选中处理
 */
const handleSelectionChange = (selection) => {
  selectedIds.value = selection.filter(item => !item.folder).map(item => item.id)
}

/**
 * 选择批量上传文件
 */
const handleFileSelect = (files) => {
  if (batchUploading.value) return
  const selectedFiles = (Array.isArray(files) ? files : [files])
    .map(file => file?.raw || file)
    .filter(Boolean)
  const existingNames = fileList.value
    .filter(item => !item.folder)
    .map(item => item.originalName)
  const validation = validateBatchUploadSelection(selectedFiles, existingNames)
  pendingUploadFiles.value = validation.files
  batchUploadResults.value = []
  uploadError.value = validation.rejected.map(item => item.reason).join('；')
  uploadProgress.value = 0
  if (validation.rejected.length > 0) {
    message.warning(`已忽略 ${validation.rejected.length} 个不可上传文件`)
  }
}

const submitBatchUpload = async () => {
  if (batchUploading.value || pendingUploadFiles.value.length === 0) return

  const files = pendingUploadFiles.value.slice()
  batchUploading.value = true
  uploadError.value = ''
  uploadProgress.value = 0
  uploadController = new AbortController()
  try {
    let result
    const onUploadProgress = event => {
      if (event?.total) uploadProgress.value = Math.min(Math.round((event.loaded / event.total) * 100), 99)
    }
    if (files.length === 1) {
      const formData = new FormData()
      formData.append('file', files[0])
      if (currentParentId.value !== null) formData.append('parentId', String(currentParentId.value))
      const response = await uploadPrintFile(formData, onUploadProgress, { signal: uploadController.signal })
      result = {
        items: [{
          index: 0,
          fileId: response.data?.id ?? null,
          fileName: response.data?.originalName || files[0].name,
          status: 'SUCCESS',
          errorCode: null,
          message: '上传成功',
          retryable: false
        }]
      }
    } else {
      const chunks = chunkItems(files, UPLOAD_BATCH_SIZE)
      const chunkLoaded = new Map()
      const totalBytes = files.reduce((total, file) => total + (Number(file.size) || 0), 0)
      const queueResults = await runUploadQueue(chunks, async (chunk, chunkIndex) => {
        const chunkProgress = event => {
          chunkLoaded.set(chunkIndex, event?.loaded || 0)
          const loaded = [...chunkLoaded.values()].reduce((total, value) => total + value, 0)
          onUploadProgress({ loaded, total: totalBytes })
        }
        return batchUploadFiles(chunk, currentParentId.value, chunkProgress, {
          signal: uploadController.signal
        })
      }, {
        concurrency: 3,
        signal: uploadController.signal
      })
      const items = []
      queueResults.forEach((queueResult, chunkIndex) => {
        const offset = chunkIndex * UPLOAD_BATCH_SIZE
        const chunk = chunks[chunkIndex]
        if (queueResult.status === 'fulfilled') {
          normalizeBatchUploadResult(queueResult.value).items.forEach(item => {
            const file = chunk[item.index]
            items.push({ ...item, index: offset + item.index, fileName: item.fileName || file?.name || '' })
          })
        } else {
          chunk.forEach((file, itemIndex) => items.push({
            index: offset + itemIndex,
            fileId: null,
            fileName: file.name,
            status: 'FAILED',
            errorCode: queueResult.reason?.response?.status || null,
            message: queueResult.reason?.message || '上传失败，可重试',
            retryable: true
          }))
        }
      })
      result = { items: items.sort((left, right) => left.index - right.index) }
    }

    const items = normalizeBatchUploadResult(result).items
    batchUploadResults.value = items
    const successfulItems = items.filter(isBatchUploadSuccess)
    const retryableFiles = items
      .filter(item => !isBatchUploadSuccess(item) && item.retryable)
      .map(item => files[item.index])
      .filter(Boolean)
    pendingUploadFiles.value = retryableFiles

    if (successfulItems.length > 0) await refreshLibrary()
    if (retryableFiles.length === 0 && successfulItems.length === files.length) {
      message.success(`已上传 ${successfulItems.length} 个文件`)
      uploadDialogVisible.value = false
      pendingUploadFiles.value = []
    } else if (successfulItems.length > 0) {
      message.warning(`已上传 ${successfulItems.length} 个文件，${files.length - successfulItems.length} 个失败`)
    } else {
      message.error('文件上传失败，请检查失败项')
    }
  } catch (error) {
    console.error('批量上传失败:', error)
    if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
      message.info('上传已取消')
    } else {
      uploadError.value = error?.message || '上传失败，可重试'
      message.error('上传失败，可重试')
    }
  } finally {
    batchUploading.value = false
    uploadProgress.value = 0
    uploadController = null
  }
}

const cancelUpload = () => {
  uploadController?.abort()
}

/**
 * 删除单个文件
 */
const handleDelete = async (id) => {
  if (batchDeleting.value || deletingIds.value.length > 0) return
  const file = fileList.value.find(item => String(item.id) === String(id))
  if (!file) {
    message.warning('文件信息不存在')
    return
  }

  try {
    await confirmMessage(file.folder ? '确定要删除这个文件夹吗？空文件夹才允许删除。' : '确定要删除吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    deletingIds.value.push(id)
    await deleteFile(id)
    message.success('删除成功')

    // 从选中列表中移除
    const index = selectedIds.value.indexOf(id)
    if (index > -1) {
      selectedIds.value.splice(index, 1)
    }

    await refreshLibrary()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      if (error?.response?.status === 422) {
        message.warning('文件夹删除失败，请先处理文件夹中的内容')
      } else {
        message.error(error?.message || '删除失败')
      }
    }
  } finally {
    deletingIds.value = deletingIds.value.filter(item => String(item) !== String(id))
  }
}

/**
 * 批量删除
 */
const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0 || batchDeleting.value || deletingIds.value.length > 0) return
  const ids = selectedIds.value.slice()

  try {
    await confirmMessage(
      `确定要删除选中的 ${ids.length} 个项目吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    batchDeleting.value = true
    const response = await deleteBatchFiles(ids)
    const items = Array.isArray(response.data?.items) ? response.data.items : []
    if (items.length !== ids.length) {
      message.warning('批量删除结果不完整，请刷新后重试未确认的项目')
      await refreshLibrary()
      return
    }
    const failedItems = items.filter(item => !item.success)
    const successItems = items.filter(item => item.success)
    selectedIds.value = failedItems.map(item => item.id)
    if (failedItems.length > 0) {
      const reasons = failedItems.map(item => `${item.id}: ${item.reason || '删除失败'}`).join('；')
      message.warning(`已删除 ${successItems.length} 项，${failedItems.length} 项失败：${reasons}`)
    } else {
      message.success(`批量删除成功，共 ${successItems.length} 项`)
    }
    await refreshLibrary()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error)
      message.error(error?.message || '批量删除失败')
    }
  } finally {
    batchDeleting.value = false
  }
}

/**
 * 发送打印
 */
const handlePrint = (file) => {
  jobForm.file = file
  jobForm.priority = 0
  jobForm.copies = 1
  jobForm.printerId = ''
  createJobDialogVisible.value = true
  loadAssignablePrinters()
}

/**
 * 从文件详情抽屉发送打印
 */
const handlePrintFromDetail = (file) => {
  jobForm.file = file
  jobForm.priority = 0
  jobForm.copies = 1
  jobForm.printerId = ''
  createJobDialogVisible.value = true
  loadAssignablePrinters()
}

/**
 * 提交创建打印任务
 */
const loadAssignablePrinters = async () => {
  loadingPrinters.value = true
  try {
    const res = await getPrinterList({ pageNum: 1, pageSize: 100, status: 'IDLE' })
    availablePrinters.value = (res.data?.records || []).filter(printer => printer.status === 'IDLE')
  } catch (error) {
    availablePrinters.value = []
    console.error('获取可用打印机失败:', error)
  } finally {
    loadingPrinters.value = false
  }
}

const handleSubmitCreateJob = async () => {
  if (!jobForm.file) {
    message.error('未选择文件')
    return
  }

  submittingJob.value = true
  let successCount = 0
  try {
    // 构建请求数据 - 直接使用数字优先级 (0-普通, 50-优先, 100-加急)
    const baseJobData = {
      fileId: jobForm.file.id,
      priority: jobForm.priority,
      ...(jobForm.printerId ? { printerId: jobForm.printerId } : {})
    }

    // 多份任务串行创建，指定同一打印机时后端可明确返回部分成功，而不会并发争抢设备。
    for (let i = 0; i < jobForm.copies; i++) {
      const idempotencyKey = `file-${jobForm.file.id}-${Date.now()}-${i}`
      await createPrintJob({ ...baseJobData, idempotencyKey }, { dedupeKey: idempotencyKey })
      successCount += 1
    }

    message.success(`已创建 ${successCount} 个任务`)
    createJobDialogVisible.value = false
  } catch (error) {
    console.error('创建打印任务失败:', error)
    const messageText = error.message || '创建任务失败'
    if (successCount > 0) {
      message.warning(`已创建 ${successCount} 个任务，剩余任务未完成：${messageText}`)
    } else {
      message.error(messageText)
    }
  } finally {
    submittingJob.value = false
  }
}

/**
 * 打开上传对话框
 */
const handleUpload = () => {
  pendingUploadFiles.value = []
  batchUploadResults.value = []
  uploadProgress.value = 0
  uploadError.value = ''
  uploadDialogVisible.value = true
}

/**
 * 获取材质标签类型
 */
const getMaterialTagType = (materialType) => {
  const types = {
    PLA: 'success',
    ABS: 'warning',
    PETG: 'primary',
    TPU: 'default',
    尼龙: 'danger'
  }
  return types[materialType] || 'default'
}

/**
 * 获取成功率样式类
 */
const getSuccessRateClass = (successRate) => {
  if (!successRate || successRate === 0) return ''
  if (successRate < 70) return 'success-rate-warning'
  return 'success-rate-success'
}

const loadFileDetail = async fileId => {
  detailLoading.value = true
  detailError.value = ''
  try {
    const [previewResult, thumbnailResult] = await Promise.allSettled([
      getFilePreview(fileId),
      getThumbnailUrl(fileId)
    ])
    if (selectedFile.value && String(selectedFile.value.id) === String(fileId)) {
      if (previewResult.status === 'fulfilled') {
        selectedFile.value = {
          ...selectedFile.value,
          ...previewResult.value.data
        }
      } else {
        detailError.value = '文件预览信息加载失败，请稍后重试'
      }
      if (thumbnailResult.status === 'fulfilled') {
        selectedFile.value.thumbnailUrl = thumbnailResult.value.data || null
        selectedFile.value.thumbnailError = false
      } else {
        selectedFile.value.thumbnailError = true
      }
    }
  } finally {
    if (selectedFile.value && String(selectedFile.value.id) === String(fileId)) {
      detailLoading.value = false
    }
  }
}

const loadFileJobs = async fileId => {
  detailJobsLoading.value = true
  detailJobsError.value = ''
  try {
    const response = await getFileJobs(fileId, { pageNum: 1, pageSize: 10 })
    if (selectedFile.value && String(selectedFile.value.id) === String(fileId)) {
      detailJobs.value = response.data?.records || []
    }
  } catch {
    if (selectedFile.value && String(selectedFile.value.id) === String(fileId)) {
      detailJobsError.value = '关联任务加载失败，请稍后重试'
    }
  } finally {
    if (selectedFile.value && String(selectedFile.value.id) === String(fileId)) {
      detailJobsLoading.value = false
    }
  }
}

/**
 * 打开文件详情
 */
const openFileDetail = (file, event) => {
  if (event) event.stopPropagation()
  selectedFile.value = { ...file, thumbnailUrl: null, thumbnailError: false }
  detailJobs.value = []
  sessionStorage.setItem(FILE_DETAIL_CONTEXT_KEY, String(file.id))
  detailDrawerVisible.value = true
  loadFileDetail(file.id)
  loadFileJobs(file.id)
}

const retryFileDetail = () => {
  if (selectedFile.value?.id) loadFileDetail(selectedFile.value.id)
}

const retryFileJobs = () => {
  if (selectedFile.value?.id) loadFileJobs(selectedFile.value.id)
}

/**
 * 关闭文件详情
 */
const closeFileDetail = () => {
  detailDrawerVisible.value = false
  selectedFile.value = null
  detailLoading.value = false
  detailJobsLoading.value = false
  sessionStorage.removeItem(FILE_DETAIL_CONTEXT_KEY)
}

/**
 * 处理文件下载
 */
const handleFileDownload = async (file) => {
  if (!file?.id) {
    message.error('文件信息不完整')
    return
  }
  try {
    await downloadFile(file.id, file.originalName)
  } catch (error) {
    // 下载接口本身的鉴权错误已由请求拦截器提示；这里处理预签名 URL 阶段的错误。
    if (error?.name === 'DownloadFileError') {
      message.error(error.message)
    }
  }
}

/**
 * 处理文件点击事件
 */
const handleFileClick = (file) => {
  if (isBatchMode.value) {
    if (file.folder) return
    // 批量操作模式：执行选择操作
    toggleSelection(file.id)
  } else {
    // 详情查看模式：如果是文件夹则打开，否则显示详情
    if (file.folder) {
      navigateToFolder(file)
    } else {
      openFileDetail(file)
    }
  }
}

/**
 * 处理表格行点击事件
 */
const handleTableRowClick = (row) => {
  if (isBatchMode.value) {
    // 批量操作模式：表格有内置的选择功能，不额外处理
  } else {
    // 详情查看模式：如果是文件夹则打开，否则显示详情
    if (row.folder) {
      navigateToFolder(row)
    } else {
      openFileDetail(row)
    }
  }
}

// ============ 生命周期 ============
onMounted(() => {
  refreshLibrary()
})
</script>

<style scoped>
/* The file workspace has one canonical visual system and one result scroll region. */
.file-library-page {
  gap: var(--app-spacing-4);
}

.file-library-page-toolbar {
  align-items: flex-start;
}

.file-library-workspace {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-large);
}

.file-library-workspace :deep(.app-data-region__body) {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
}

.file-library-workspace :deep(.t-empty) {
  padding: var(--app-spacing-8) var(--app-spacing-4);
}

.file-library-workspace :deep(.t-alert) {
  flex: 0 0 auto;
}

.file-library-layout {
  display: grid;
  flex: 1 1 0%;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.file-library-sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: var(--app-spacing-5);
  background: var(--app-surface-muted);
  border-right: 1px solid var(--app-border);
}

.file-library-panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-spacing-3);
  flex: 0 0 auto;
  padding-bottom: var(--app-spacing-4);
}

.file-library-panel-heading h2,
.file-library-results-heading h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 16px;
  font-weight: 700;
}

.file-library-panel-heading p,
.file-library-results-heading span {
  margin: 4px 0 0;
  color: var(--app-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.file-library-tree {
  flex: 1 1 0%;
  min-height: 0;
  padding: var(--app-spacing-2);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  overflow-y: auto;
}

.file-library-tree :deep(.t-tree) {
  min-width: 0;
}

.file-library-tree :deep(.t-tree__label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-library-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: var(--app-spacing-5);
  background: var(--app-surface);
  overflow: hidden;
}

.file-library-filter-row {
  align-items: center;
  gap: var(--app-spacing-4);
  margin-bottom: var(--app-spacing-4);
  padding: 0 0 var(--app-spacing-4);
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--app-border);
}

.file-library-navigation {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.file-library-section-label {
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.file-library-navigation :deep(.t-breadcrumb) {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.file-library-toolbar__filters {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-spacing-3);
}

.file-library-toolbar__filters .t-input:first-of-type {
  width: min(240px, 24vw);
}

.file-library-toolbar__filters .t-input:last-of-type {
  width: 132px;
}

.file-library-results {
  display: flex;
  flex: 1 1 0%;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.file-library-results-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-3);
  flex: 0 0 auto;
  margin-bottom: var(--app-spacing-3);
}

.file-library-list,
.file-table-view {
  display: flex;
  flex: 1 1 0%;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.file-table-view :deep(.t-table__content) {
  min-height: 0;
  height: 100%;
  scrollbar-gutter: stable;
  scrollbar-color: var(--app-scrollbar-thumb) var(--app-scrollbar-track);
  scrollbar-width: thin;
  overflow-y: auto;
}

.file-table-view :deep(.t-table__content::-webkit-scrollbar) { width: 8px; height: 8px; }
.file-table-view :deep(.t-table__content::-webkit-scrollbar-track) { background: var(--app-scrollbar-track); }
.file-table-view :deep(.t-table__content::-webkit-scrollbar-thumb) {
  background: var(--app-scrollbar-thumb);
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}
.file-table-view :deep(.t-table__content::-webkit-scrollbar-thumb:hover) {
  background: var(--app-scrollbar-thumb-hover);
  background-clip: padding-box;
}

.file-table-view :deep(.td-table-adapter),
.file-table-view :deep(.t-table) {
  min-height: 0;
  height: 100%;
}

.file-view-toggle {
  display: inline-flex;
  flex: 0 0 auto;
  padding: 3px;
  background: var(--app-surface-muted);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
}

.file-view-toggle :deep(.t-button) {
  min-width: 32px;
  color: var(--app-text-secondary);
}

.file-view-toggle :deep(.file-view-toggle__active) {
  color: var(--app-primary);
  background: var(--app-surface);
  box-shadow: var(--app-shadow);
}

.file-grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
  gap: var(--app-spacing-4);
  align-content: start;
  min-height: 0;
  padding: 2px 2px var(--app-spacing-3);
  overflow-y: auto;
}

.file-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 280px;
  flex-direction: column;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.file-card__selection {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
}

.file-card:hover,
.file-card--selected {
  border-color: var(--app-primary);
  box-shadow: var(--app-shadow-raised);
}

.file-card__media {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  height: 128px;
  flex-shrink: 0;
  background: var(--app-surface-muted);
  border-bottom: 1px solid var(--app-border);
  overflow: hidden;
}

.file-card__thumbnail {
  width: 100%;
  height: 100%;
}

.file-card__material-tag {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
}

.file-card__media--folder {
  color: var(--app-primary);
  background: var(--app-primary-light);
}

.file-card__media-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
  color: var(--app-text-secondary);
  font-size: 12px;
}

.file-card__metric-icon {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
}

.file-card__body {
  display: flex;
  min-height: 150px;
  flex: 1;
  flex-direction: column;
  padding: var(--app-spacing-4);
}

.file-card__name {
  margin: 0 0 var(--app-spacing-3);
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
  margin-bottom: var(--app-spacing-3);
  color: var(--app-text-secondary);
  font-size: 12px;
}

.file-card__metrics > div {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-card__stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-3);
  margin-bottom: var(--app-spacing-3);
  padding: 10px;
  color: var(--app-text-secondary);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius-small);
}

.file-card__stats > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.file-card__stat-label {
  color: var(--app-text-secondary);
  font-size: 11px;
}

.file-card__stat-value {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 700;
}

.file-card__success-rate {
  display: flex !important;
  flex: 1 1 auto;
  align-items: center;
  flex-direction: row !important;
  gap: 8px !important;
}

.file-card__success-rate-progress {
  min-width: 40px;
  flex: 1 1 auto;
}

.file-card__actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}

.file-card__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-card__action {
  flex: 1 1 0;
}

.file-library-pagination {
  display: flex;
  justify-content: flex-end;
  flex: 0 0 auto;
  padding-top: var(--app-spacing-4);
}

.file-table__name-cell {
  display: flex;
  align-items: center;
  gap: var(--app-spacing-2);
  min-width: 0;
}

.file-table__icon {
  display: flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--app-text-secondary);
  background: var(--app-surface-muted);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-small);
}

.file-table__folder-icon {
  color: var(--app-primary);
}

.file-table__file-icon {
  color: var(--app-text-secondary);
}

.file-table__thumbnail {
  width: 100%;
  height: 100%;
}

.file-table__name {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-table__type-tag {
  flex: 0 0 auto;
}

.file-table__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-spacing-2);
}

.file-table__rate {
  display: flex;
  align-items: center;
  gap: var(--app-spacing-2);
}

.file-table__rate :deep(.t-progress) {
  width: 64px;
}

@media (max-width: 900px) {
  .file-library-filter-row {
    align-items: stretch;
    flex-direction: column;
  }

  .file-library-navigation,
  .file-library-toolbar__filters {
    width: 100%;
  }

  .file-library-toolbar__filters {
    justify-content: flex-start;
  }

  .file-library-toolbar__filters .t-input:first-of-type,
  .file-library-toolbar__filters .t-input:last-of-type {
    flex: 1 1 180px;
    width: auto;
  }
}

@media (max-width: 1024px) {
  .file-library-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(48px, 22%) minmax(0, 1fr);
  }

  .file-library-sidebar {
    padding: var(--app-spacing-3);
    border-right: 0;
    border-bottom: 1px solid var(--app-border);
  }

  .file-library-main {
    padding: var(--app-spacing-3);
  }

  .file-library-filter-row {
    display: flex;
    align-items: stretch;
    flex-direction: column;
    gap: var(--app-spacing-2);
    margin-bottom: var(--app-spacing-2);
    padding-bottom: var(--app-spacing-2);
  }

  .file-library-navigation,
  .file-library-toolbar__filters {
    width: 100%;
  }

  .file-library-navigation {
    min-width: 0;
  }

  .file-library-toolbar__filters {
    flex-wrap: nowrap;
    gap: var(--app-spacing-2);
  }

  .file-library-toolbar__filters .t-input:first-of-type {
    width: 120px;
  }

  .file-library-toolbar__filters .t-input:last-of-type {
    width: 80px;
  }

  .file-library-results-heading {
    align-items: baseline;
    margin-bottom: var(--app-spacing-2);
  }

  .file-library-results-heading > div {
    display: flex;
    align-items: baseline;
    gap: var(--app-spacing-2);
    flex-wrap: nowrap;
    white-space: nowrap;
  }

  .file-library-results-heading h2,
  .file-library-results-heading span {
    margin-top: 0;
    white-space: nowrap;
  }

  .file-library-list {
    min-height: 64px;
  }

}

@media (max-width: 640px) {
  .file-library-page-toolbar {
    align-items: stretch;
  }

  .file-library-toolbar__actions {
    justify-content: flex-start;
  }

  .file-library-layout {
    display: flex;
    height: auto;
    min-height: 0;
    flex-direction: column;
  }

  .file-library-sidebar {
    flex: 0 0 190px;
    max-height: 190px;
    padding: var(--app-spacing-3);
    border-right: 0;
    border-bottom: 1px solid var(--app-border);
  }

  .file-library-main {
    min-height: 420px;
    padding: var(--app-spacing-3);
  }

  .file-library-pagination {
    justify-content: center;
  }
}

</style>
