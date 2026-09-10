<template>
  <div class="app-page-shell app-page-background file-library-page">
    <PageHeader
      title="文件库"
    />

    <t-layout class="file-library-layout">
      <t-aside width="210px" class="file-library-sidebar">
        <t-card bordered class="file-library-sidebar-card" aria-label="文件夹导航">
          <FileFolderTree
            ref="folderTreeRef"
            :current-parent-id="currentParentId"
            :deleting-folder-id="deletingFolderId"
            :folder-action-loading="folderActionLoading"
            @select="handleFolderSelect"
            @loaded="handleFolderTreeLoaded"
            @create="openCreateFolderDialog"
            @folder-action="handleFolderAction"
          />
        </t-card>
      </t-aside>
          <t-content class="file-library-content">
            <section class="file-library-main" aria-label="当前目录文件列表">
              <t-card bordered class="file-library-toolbar-card" aria-label="文件操作工具栏">
                <div class="file-library-filter-form" aria-label="文件筛选条件">
                <t-space class="file-library-toolbar-actions" size="small" align="center" break-line>
                  <t-button theme="primary" size="medium" :icon="renderIcon(Upload)" :disabled="!canUpload" @click="handleUpload">
                    上传
                  </t-button>
                  <t-button v-if="selectedIds.length > 0" theme="danger" size="medium" :icon="renderIcon(Delete)"
                    :loading="batchDeleting" :disabled="batchDeleting || batchMoving || deletingIds.length > 0 || !canBatchDelete" @click="handleBatchDelete">
                    批量删除 ({{ selectedIds.length }})
                  </t-button>
                  <t-button v-if="selectedIds.length > 0" theme="primary" variant="outline" size="medium"
                    :icon="renderIcon(Move)" :loading="batchMoving"
                    :disabled="batchMoving || batchDeleting || deletingIds.length > 0 || !canBatchMove" @click="openBatchMoveDialog">
                    批量移动 ({{ selectedIds.length }})
                  </t-button>
                </t-space>
                <t-space class="file-library-search-actions" size="small" align="center" break-line>
                  <t-radio-group class="file-library-view-mode" v-model="viewMode" variant="default-filled" size="medium" aria-label="文件视图">
                    <t-radio-button value="list" aria-label="列表视图">
                      <List :size="16" />
                    </t-radio-button>
                    <t-radio-button value="grid" aria-label="网格视图">
                      <Grid :size="16" />
                    </t-radio-button>
                  </t-radio-group>
                  <t-input class="file-library-search-input" v-model="searchKeyword" placeholder="搜索文件名..." clearable size="medium"
                    @keyup.enter="handleSearch">
                    <template #prefixIcon>
                      <Search />
                    </template>
                  </t-input>
                  <t-button theme="primary" size="medium" :loading="loading" @click="handleSearch">
                    查询
                  </t-button>
                </t-space>
                </div>
              </t-card>

          <div v-if="loading || (loadError && !fileList.length)" class="file-library-status-region" aria-live="polite">
            <AsyncState
              :loading="loading"
              :error="loadError"
              @retry="fetchData"
            />
          </div>
          <t-empty v-else-if="fileList.length === 0" class="file-library-empty" description="当前目录暂无文件">
            <template #operation>
              <t-space>
                <t-button v-if="canCreateFolder" size="small" variant="outline" @click="openCreateFolderDialog">新建文件夹</t-button>
                <t-button size="small" theme="primary" :disabled="!canUpload" @click="handleUpload">上传</t-button>
              </t-space>
            </template>
          </t-empty>
          <t-alert v-if="loadError && fileList.length" theme="error" :close-btn="false" class="mb-3">
            <template #default>{{ loadError }}</template>
            <template #operation>
              <t-button size="small" variant="outline" @click="fetchData">重试</t-button>
            </template>
          </t-alert>

          <!-- 网格视图 -->
          <t-card v-if="fileList.length && viewMode === 'grid'" bordered class="file-library-results-card file-library-grid-card" aria-label="文件网格列表">
            <div class="file-grid-view app-scroll-region">
        <!-- 文件 -->
        <div
          v-for="file in fileRows"
          :key="file.id"
          class="file-card-context"
          @contextmenu="captureContextMenu"
        >
          <t-dropdown :options="getContextMenuOptions(file)" trigger="context-menu" :popup-props="contextMenuPopupProps"
            @click="handleContextMenuClick($event, file)">
            <t-card bordered hover-shadow class="file-card"
              :class="{ 'file-card--selected': selectedIds.includes(file.id) }"
              @click="handleFileClick(file)">
              <!-- 文件选择框始终可见，避免浏览/选择模式切换造成布局跳动。 -->
              <div class="file-card__selection">
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
                <t-tooltip
                  class="file-card__material-tooltip"
                  :content="String(file.materialType || '未指定')"
                >
                  <t-tag :theme="getMaterialTagType(file.materialType)" class="file-card__material-tag" size="small">
                    {{ file.materialType || '未指定' }}
                  </t-tag>
                </t-tooltip>
              </div>

              <!-- 卡片内容 -->
              <div class="file-card__body">
                <t-tooltip
                  class="file-card__name-tooltip"
                  :content="getFileNameLabel(file.originalName)"
                >
                  <h3 class="file-card__name">
                    {{ getFileNameLabel(file.originalName) }}
                  </h3>
                </t-tooltip>

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
                    <t-tooltip
                      class="file-card__success-rate-tooltip"
                      :content="formatMetric(file.successRate, '%')"
                    >
                      <t-tag
                        :theme="getSuccessRateTheme(file.successRate)"
                        size="small"
                        class="file-card__success-rate-tag"
                      >
                        {{ formatMetric(file.successRate, '%') }}
                      </t-tag>
                    </t-tooltip>
                  </div>
                </div>

                <!-- 悬浮操作按钮 -->
                <div class="file-card__actions">
                  <t-button v-if="file.canPrint === true" theme="primary" size="small" :icon="renderIcon(Printer)" @click.stop="handlePrint(file)"
                    class="file-card__action">
                    打印
                  </t-button>
                  <t-button v-if="file.canDelete === true" theme="danger" size="small" :icon="renderIcon(Delete)" @click.stop="handleDelete(file.id)"
                    class="file-card__action">
                    删除
                  </t-button>
                </div>
              </div>
            </t-card>
          </t-dropdown>
        </div>
            </div>
          </t-card>

      <!-- 列表视图 -->
          <t-card v-if="fileList.length && viewMode === 'list'" bordered class="file-library-results-card file-library-table-card" aria-label="文件表格列表">
            <div class="file-table-view">
        <TdTable :data="fileRows" row-key="id" :loading="loading" height="100%" hover @selection-change="handleSelectionChange"
          @row-click="handleTableRowClick" border style="width: 100%">
          <TdTableColumn type="selection" width="50" align="center" :check-props="getRowCheckProps" />

          <TdTableColumn prop="originalName" label="文件名" min-width="200">
            <template #default="{ row }">
              <t-dropdown :options="getContextMenuOptions(row)" trigger="context-menu" :popup-props="contextMenuPopupProps"
                @click="handleContextMenuClick($event, row)">
                <div class="file-table__name-cell" @contextmenu="captureContextMenu">
                  <div class="file-table__icon">
                    <t-image v-if="row.thumbnailUrl" :src="row.thumbnailUrl" fit="cover" class="file-table__thumbnail">
                      <template #error>
                        <span class="file-table__file-icon">
                          <Document />
                        </span>
                      </template>
                    </t-image>
                    <span v-else class="file-table__file-icon">
                      <Document />
                    </span>
                  </div>
                  <t-tooltip
                    class="file-table__name-tooltip"
                    :content="getFileNameLabel(row.originalName)"
                  >
                    <span class="file-table__name">{{ getFileNameLabel(row.originalName) }}</span>
                  </t-tooltip>
                  <t-tooltip
                    class="file-table__type-tooltip"
                    :content="String(row.materialType || '未指定')"
                  >
                    <t-tag :theme="getMaterialTagType(row.materialType)" size="small" class="file-table__type-tag">
                      {{ row.materialType || '未指定' }}
                    </t-tag>
                  </t-tooltip>
                </div>
              </t-dropdown>
            </template>
          </TdTableColumn>

          <TdTableColumn prop="fileSize" label="文件大小" width="100">
            <template #default="{ row }">
              <t-tooltip class="file-table__metric-tooltip" :content="formatFileSize(row.fileSize)"><span class="file-table__metric">{{ formatFileSize(row.fileSize) }}</span></t-tooltip>
            </template>
          </TdTableColumn>

          <TdTableColumn prop="estTime" label="预计耗时" width="85">
            <template #default="{ row }">
              <t-tooltip class="file-table__metric-tooltip" :content="formatDuration(row.estTime)"><span class="file-table__metric">{{ formatDuration(row.estTime) }}</span></t-tooltip>
            </template>
          </TdTableColumn>

          <TdTableColumn prop="filamentWeight" label="耗材重量" width="85">
            <template #default="{ row }">
              <t-tooltip class="file-table__metric-tooltip" :content="formatMetric(row.filamentWeight, 'g')"><span class="file-table__metric">{{ formatMetric(row.filamentWeight, 'g') }}</span></t-tooltip>
            </template>
          </TdTableColumn>

          <TdTableColumn prop="filamentLength" label="所需线长" width="85">
            <template #default="{ row }">
              <t-tooltip class="file-table__metric-tooltip" :content="formatMetric(row.filamentLength, 'm')"><span class="file-table__metric">{{ formatMetric(row.filamentLength, 'm') }}</span></t-tooltip>
            </template>
          </TdTableColumn>

          <TdTableColumn prop="printCount" label="打印次数" width="80">
            <template #default="{ row }">
              <t-tooltip class="file-table__metric-tooltip" :content="formatMetric(row.printCount, '次')"><span class="file-table__metric">{{ formatMetric(row.printCount, '次') }}</span></t-tooltip>
            </template>
          </TdTableColumn>

          <TdTableColumn prop="successRate" label="成功率" width="100">
            <template #default="{ row }">
              <t-tooltip class="file-table__rate-tooltip" :content="formatMetric(row.successRate, '%')">
                <t-tag
                  :theme="getSuccessRateTheme(row.successRate)"
                  size="small"
                  class="file-table__rate-tag"
                >
                  {{ formatMetric(row.successRate, '%') }}
                </t-tag>
              </t-tooltip>
            </template>
          </TdTableColumn>

          <TdTableColumn label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <div class="file-table__actions">
                <t-button v-if="row.canPrint === true" theme="primary" size="small" :icon="renderIcon(Printer)" @click.stop="handlePrint(row)">
                  打印
                </t-button>
                <t-button v-if="row.canDelete === true" theme="danger" size="small" :icon="renderIcon(Delete)" :loading="deletingIds.includes(row.id)"
                  :disabled="batchDeleting || batchMoving || deletingIds.length > 0" @click.stop="handleDelete(row.id)">
                  删除
                </t-button>
              </div>
            </template>
          </TdTableColumn>
        </TdTable>
            </div>
          </t-card>

          <div v-if="fileList.length > 0" class="file-library-pagination">
            <t-pagination v-model:current="pagination.pageNum" v-model:pageSize="pagination.pageSize"
              :total="pagination.total" :show-page-size="false"
              @change="handlePageChange" />
          </div>
          </section>
        </t-content>
      </t-layout>

    <!-- 文件上传对话框 -->
    <t-dialog v-model:visible="uploadDialogVisible" header="批量上传切片文件"
      width="min(600px, calc(100vw - 32px))"
      placement="center"
      dialog-class-name="file-upload-dialog"
      :prevent-scroll-through="true"
      :footer="true"
    >
      <div class="file-upload-dialog__content">
        <t-upload theme="custom" draggable multiple :auto-upload="false" accept=".gcode,.g,.3mf,.stl"
          @select-change="handleFileSelect" class="file-upload-dialog__upload">
          <div class="farm-upload__content">
            <span class="farm-icon--upload">
              <UploadFilled />
            </span>
            <div class="farm-upload__text">
              拖拽多个切片文件到此处 或 <em>点击上传</em>
            </div>
          </div>
          <template #tips>
            <div class="farm-upload__tip">
              支持 .gcode、.g、.3mf、.stl 格式，最多 100 个文件；单个文件不超过 1GB。
            </div>
          </template>
        </t-upload>

        <div v-if="uploadFileStates.length || batchUploadResults.length" class="file-upload-dialog__file-list">
          <section v-if="uploadFileStates.length" class="file-upload-dialog__section" aria-label="待上传文件列表">
            <div class="file-upload-dialog__section-title">待上传文件（{{ pendingUploadFiles.length }}）</div>
            <div v-for="state in uploadFileStates" :key="`${state.file.name}-${state.file.lastModified}`"
              class="file-upload-dialog__item">
              <t-tooltip class="file-upload-dialog__item-name-tooltip" :content="String(state.file.name || '未命名文件')">
                <span class="file-upload-dialog__item-name">{{ state.file.name || '未命名文件' }}</span>
              </t-tooltip>
              <span class="file-upload-dialog__item-progress">
                <t-progress v-if="state.status === 'uploading'" :percentage="state.progress" :show-info="false" :stroke-width="4" />
                <span class="file-upload-dialog__item-status" :class="state.status === 'success' ? 'text-green-600' : state.status === 'failed' ? 'text-red-600' : ''">
                  {{ state.status === 'uploading' ? `${state.progress}%` : state.status === 'success' ? '成功' : state.status === 'failed' ? (state.message || '失败') : state.status === 'unknown' ? '结果未知' : '待上传' }}
                </span>
              </span>
            </div>
            <t-progress v-if="batchUploading" :percentage="uploadProgress" />
          </section>

          <section v-if="batchUploadResults.length" class="file-upload-dialog__section" aria-label="上传结果列表">
            <t-alert
              :theme="batchUploadResults.every(isBatchUploadSuccess) ? 'success' : 'warning'"
              :title="batchUploadResults.every(isBatchUploadSuccess) ? '全部文件上传成功' : '部分文件未上传成功'"
              :close-btn="false"
            />
            <div v-for="result in batchUploadResults" :key="`${result.index}-${result.fileName}`"
              class="file-upload-dialog__item">
              <t-tooltip
                class="file-upload-dialog__item-name-tooltip"
                :content="String(result.fileName || `第 ${result.index + 1} 项`)"
              >
                <span class="file-upload-dialog__item-name">{{ result.fileName || `第 ${result.index + 1} 项` }}</span>
              </t-tooltip>
              <span class="file-upload-dialog__item-status"
                :class="isBatchUploadSuccess(result) ? 'text-green-600' : 'text-red-600'">
                {{ isBatchUploadSuccess(result) ? '成功' : (result.message || '失败') }}
              </span>
            </div>
          </section>
        </div>

        <div v-if="uploadError" class="file-upload-dialog__error">
          <t-alert theme="error" :title="uploadError" :close-btn="false" />
        </div>
      </div>

      <template #footer>
        <div class="file-upload-dialog__footer">
          <t-button variant="outline" :disabled="batchUploading" @click="handleUpload">重新选择</t-button>
          <t-button variant="outline" :disabled="!batchUploading" @click="cancelUpload">取消上传</t-button>
          <t-button theme="primary" :loading="batchUploading"
            :disabled="!pendingUploadFiles.length || batchUploading" @click="submitBatchUpload">
            {{ batchUploadResults.length && pendingUploadFiles.length
              ? `重试可重试失败项（${pendingUploadFiles.length}）`
              : '开始上传' }}
          </t-button>
        </div>
      </template>
    </t-dialog>

    <!-- 新建文件夹对话框 -->
    <t-dialog v-model:visible="createFolderDialogVisible" header="新建文件夹"
      width="min(400px, calc(100vw - 32px))"
      placement="center"
      dialog-class-name="create-folder-dialog"
      :prevent-scroll-through="true"
    >
      <t-form :data="folderForm" :rules="folderRules" ref="folderFormRef" layout="vertical" label-align="left" label-width="96px" class="create-folder-form">
        <t-form-item label="文件夹名称" name="name" class="create-folder-form__item">
          <div class="create-folder-form__control">
            <t-input v-model="folderForm.name" placeholder="请输入文件夹名称" />
          </div>
        </t-form-item>
        <t-form-item label="目录级别" name="level" class="create-folder-form__item">
          <div class="create-folder-form__control create-folder-form__control--level">
            <t-radio-group v-model="folderForm.level" class="create-folder-form__level-radio-group">
              <t-radio-button :value="1">一级目录</t-radio-button>
              <t-radio-button :value="2">二级目录</t-radio-button>
            </t-radio-group>
          </div>
        </t-form-item>
        <t-form-item v-if="folderForm.level === 2" label="一级父目录" name="parentId" class="create-folder-form__item">
          <div class="create-folder-form__control">
            <t-select v-model="folderForm.parentId" placeholder="请选择一级父目录" clearable>
              <t-option
                v-for="folder in firstLevelFolders"
                :key="folder.value"
                :value="folder.value"
                :label="folder.label"
              />
            </t-select>
          </div>
        </t-form-item>
        <t-form-item v-if="folderForm.level === 1 && userStore.userInfo?.role === 'ADMIN'" label="可见性" name="visibility" class="create-folder-form__item">
          <div class="create-folder-form__control">
            <t-radio-group v-model="folderForm.visibility">
              <t-radio-button value="PRIVATE">个人目录</t-radio-button>
              <t-radio-button value="PUBLIC">公共目录</t-radio-button>
            </t-radio-group>
          </div>
        </t-form-item>
      </t-form>

      <template #footer>
        <div class="create-folder-dialog__footer">
          <t-button @click="createFolderDialogVisible = false">取消</t-button>
          <t-button theme="primary" @click="handleCreateFolder" :loading="creatingFolder">
            创建
          </t-button>
        </div>
      </template>
    </t-dialog>

    <!-- 重命名文件夹对话框 -->
    <t-dialog v-model:visible="renameFolderDialogVisible" header="重命名文件夹" width="400px"
      :close-on-overlay-click="false">
      <t-form ref="renameFolderFormRef" :data="renameFolderForm" :rules="renameFolderRules" label-width="80px">
        <t-form-item label="文件夹名称" name="name">
          <t-input v-model="renameFolderForm.name" placeholder="请输入文件夹名称" :maxlength="100" />
        </t-form-item>
      </t-form>

      <template #footer>
        <div class="flex justify-end gap-3">
          <t-button :disabled="folderActionLoading" @click="renameFolderDialogVisible = false">取消</t-button>
          <t-button theme="primary" :loading="folderActionLoading" @click="handleRenameFolder">保存</t-button>
        </div>
      </template>
    </t-dialog>

    <!-- 移动文件夹对话框 -->
    <t-dialog v-model:visible="moveFolderDialogVisible" header="移动到" width="400px"
      :close-on-overlay-click="false">
      <t-form ref="moveFolderFormRef" :data="moveFolderForm" :rules="moveFolderRules" label-width="80px">
        <t-form-item label="目标目录" name="parentId">
          <t-select v-model="moveFolderForm.parentId" placeholder="请选择目标目录">
            <t-option
              v-for="target in moveFolderTargets"
              :key="target.value ?? 'root'"
              :value="target.value"
              :label="target.label"
            />
          </t-select>
        </t-form-item>
      </t-form>
      <t-alert theme="warning" :close-btn="false" class="mt-3">
        仅移动文件夹目录记录，不会移动其中的文件；目标目录必须与源目录属于同一用户。
      </t-alert>

      <template #footer>
        <div class="flex justify-end gap-3">
          <t-button :disabled="folderActionLoading" @click="moveFolderDialogVisible = false">取消</t-button>
          <t-button theme="primary" :loading="folderActionLoading" @click="handleMoveFolder">移动</t-button>
        </div>
      </template>
    </t-dialog>

    <!-- 批量移动文件对话框 -->
    <t-dialog v-model:visible="batchMoveDialogVisible" header="批量移动文件"
      width="min(480px, calc(100vw - 32px))"
      placement="center"
      :close-on-overlay-click="false"
      :close-on-esc-keydown="!batchMoving"
    >
      <t-form ref="batchMoveFormRef" :data="batchMoveForm" label-width="96px">
        <t-form-item label="目标文件夹" name="parentId">
          <t-select v-model="batchMoveForm.parentId" placeholder="请选择目标文件夹" :disabled="batchMoving">
            <t-option
              v-for="target in batchMoveTargets"
              :key="target.value ?? 'root'"
              :value="target.value"
              :label="target.label"
              :disabled="target.disabled"
            />
          </t-select>
        </t-form-item>
      </t-form>
      <t-alert theme="warning" :close-btn="false" class="mt-3">
        仅移动选中的文件，不会移动文件夹；单次最多100个文件。
      </t-alert>

      <section v-if="batchMoveResults.length" class="file-move-dialog__results" aria-label="批量移动结果">
        <t-alert
          :theme="batchMoveResults.every(item => item.success) ? 'success' : 'warning'"
          :title="batchMoveResults.every(item => item.success) ? '全部文件移动成功' : '部分文件移动失败'"
          :close-btn="false"
        />
        <div v-for="result in batchMoveResults" :key="String(result.id)" class="file-move-dialog__result">
          <span class="file-move-dialog__result-id">文件 {{ result.id }}</span>
          <span :class="result.success ? 'text-green-600' : 'text-red-600'">
            {{ result.success ? '移动成功' : (result.reason || '移动失败') }}
          </span>
        </div>
      </section>
      <t-alert v-if="batchMoveError" theme="error" :title="batchMoveError" :close-btn="false" class="mt-3" />

      <template #footer>
        <div class="flex justify-end gap-3">
          <t-button :disabled="batchMoving" @click="batchMoveDialogVisible = false">取消</t-button>
          <t-button theme="primary" :loading="batchMoving" :disabled="batchMoving" @click="handleBatchMove">
            移动
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
      width="min(480px, calc(100vw - 32px))"
      placement="center"
      dialog-class-name="create-job-dialog"
      :prevent-scroll-through="true"
      :close-on-overlay-click="false"
      :close-on-esc-keydown="true"
    >
      <div class="create-job-form">
        <!-- 文件信息展示 -->
        <section class="create-job-form__file-summary" aria-label="待创建任务的文件信息">
          <div class="create-job-form__file-summary-row">
            <div class="create-job-form__file-thumbnail">
              <t-image
                v-if="jobForm.file?.thumbnailUrl"
                :src="jobForm.file?.thumbnailUrl"
                fit="cover"
                class="create-job-form__file-thumbnail-image"
              >
                <template #error>
                  <div class="create-job-form__file-thumbnail-placeholder">
                    <span><Document /></span>
                  </div>
                </template>
              </t-image>
              <div v-else class="create-job-form__file-thumbnail-placeholder">
                <span><Document /></span>
              </div>
            </div>
            <div class="create-job-form__file-meta">
              <div class="create-job-form__file-label">当前选中文件</div>
              <t-tooltip
                class="create-job-file-name-tooltip"
                :content="getFileNameLabel(jobForm.file?.originalName)"
              >
                <div class="create-job-form__file-name">
                  {{ getFileNameLabel(jobForm.file?.originalName) }}
                </div>
              </t-tooltip>
            </div>
          </div>
        </section>

        <!-- 表单区域 -->
        <t-form :data="jobForm" layout="vertical" label-align="left" label-width="96px" size="medium" class="create-job-form__fields">
          <!-- 任务优先级 -->
          <t-form-item label="任务优先级" class="create-job-form__item">
            <div class="create-job-form__control create-job-form__control--priority">
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
            </div>
          </t-form-item>

          <t-form-item label="打印机" class="create-job-form__item">
            <div class="create-job-form__control">
              <t-select v-model="jobForm.printerId" class="create-job-form__select" placeholder="不指定，创建后进入队列" clearable :loading="loadingPrinters">
              <t-option label="不指定（进入队列）" value="" />
              <t-option
                v-for="printer in availablePrinters"
                :key="printer.id"
                :label="`${printer.name}（${printer.machineNumber || `#${printer.id}`}）`"
                :title="`${printer.name}（${printer.machineNumber || `#${printer.id}`}）`"
                :value="printer.id"
              />
              </t-select>
              <div class="create-job-form__tip">指定打印机只记录分配目标，不会跳过安全确认流程</div>
            </div>
          </t-form-item>

          <!-- 打印份数 -->
          <t-form-item label="打印份数" class="create-job-form__item">
            <div class="create-job-form__control">
              <t-input-number
                v-model="jobForm.copies"
                :min="1"
                :max="99"
                :step="1"
                class="create-job-form__copies"
              />
              <div class="create-job-form__tip">将为同一文件创建多个排队任务</div>
            </div>
          </t-form-item>
        </t-form>
      </div>

      <template #footer>
        <div class="create-job-dialog__footer">
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
import { ref, reactive, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { message, confirmMessage } from '@/utils/message'
import { renderIcon } from '@/utils/tdesign'
import {
  SearchIcon as Search,
  DeleteIcon as Delete,
  CloudUploadIcon as UploadFilled,
  ImageIcon as Picture,
  FileIcon as Document,
  ZoomInIcon as ScaleToOriginal,
  FullscreenIcon as FullScreen,
  TimeIcon as Clock,
  GridViewIcon as Grid,
  ViewListIcon as List,
  PrintIcon as Printer,
  UploadIcon as Upload,
  DownloadIcon as Download,
  FolderMoveIcon as Move
} from 'tdesign-icons-vue-next'
import {
  getFileList,
  uploadFile as uploadPrintFile,
  deleteFile,
  deleteBatchFiles,
  moveBatchFiles,
  downloadFile,
  createFolder,
  renameFolder,
  moveFolder,
  deleteFolder,
  getFilePreview,
  getThumbnailUrl,
  getFileJobs
} from '@/api/printFile'
import { createPrintJob } from '@/api/job'
import { getPrinterList } from '@/api/printer'
import { formatDuration, formatFileSize } from '@/utils/formatters'
import FileDetailDrawer from '@/components/file/FileDetailDrawer.vue'
import FileFolderTree from '@/components/file/FileFolderTree.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import AsyncState from '@/components/AsyncState.vue'
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'
import {
  getUploadFailureState,
  isBatchUploadSuccess,
  normalizeBatchUploadResult,
  validateBatchUploadSelection
} from '@/utils/batchUpload'
import { runUploadQueue } from '@/utils/uploadQueue'
import { useUserStore } from '@/stores/user'

defineOptions({ name: 'FileLibrary' })

// ============ 状态定义 ============
const loading = ref(false)
const loadError = ref('')
const fileList = ref([])
const selectedIds = ref([])
const searchKeyword = ref('')
const viewMode = ref('list')
const uploadDialogVisible = ref(false)
const createFolderDialogVisible = ref(false)
const creatingFolder = ref(false)
const pendingUploadFiles = ref([])
const uploadFileStates = ref([])
const batchUploadResults = ref([])
const batchUploading = ref(false)
const batchDeleting = ref(false)
const batchMoving = ref(false)
const batchMoveDialogVisible = ref(false)
const batchMoveResults = ref([])
const batchMoveError = ref('')
const deletingIds = ref([])
const uploadProgress = ref(0)
const uploadError = ref('')
let uploadController = null
let searchTimer = null
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
// 文件夹导航状态
const currentParentId = ref(null)
const directoryReady = ref(false)
const folderTreeRef = ref(null)
const folderTreeFolders = ref([])
const deletingFolderId = ref(null)
const folderActionLoading = ref(false)
const renameFolderDialogVisible = ref(false)
const moveFolderDialogVisible = ref(false)
const actionFolder = ref(null)
const renameFolderForm = reactive({ name: '' })
const moveFolderForm = reactive({ parentId: null })
const renameFolderFormRef = ref(null)
const moveFolderFormRef = ref(null)
const batchMoveFormRef = ref(null)
const userStore = useUserStore()
let fileRequestSequence = 0

// 新建文件夹表单
const folderForm = reactive({
  name: '',
  level: 1,
  parentId: null,
  visibility: 'PRIVATE'
})

const folderRules = {
  name: [
    { required: true, message: '请输入文件夹名称', trigger: 'blur' },
    { min: 1, max: 100, message: '文件夹名称长度在 1 到 100 个字符之间', trigger: 'blur' }
  ],
  level: [{ required: true, message: '请选择目录级别', trigger: 'change' }],
  parentId: [{ required: true, message: '请选择一级父目录', trigger: 'change' }]
}

const folderNameValidationRule = {
  validator: value => {
    const name = String(value || '').trim()
    const hasControlCharacter = [...name].some(character => character.charCodeAt(0) < 32)
    return name.length > 0 && name.length <= 100 && !hasControlCharacter && !/[\\/:*?"<>|]/.test(name)
  },
  message: '名称不能为空、不能超过100个字符且不能包含非法字符',
  trigger: 'blur'
}

const renameFolderRules = {
  name: [
    { required: true, message: '请输入文件夹名称', trigger: 'blur' },
    folderNameValidationRule
  ]
}

const moveFolderRules = {}

const BATCH_MOVE_ROOT_VALUE = '__root__'
const batchMoveForm = reactive({ parentId: '' })

const folderFormRef = ref(null)

watch(() => folderForm.level, level => {
  if (Number(level) === 1) folderForm.parentId = null
})

// 分页状态
const pagination = reactive({
  pageNum: 1,
  pageSize: 12,
  total: 0
})

const flattenFolders = (nodes, result = []) => {
  nodes.forEach(node => {
    if (node?.folder !== false) result.push(node)
    if (Array.isArray(node?.children)) flattenFolders(node.children, result)
  })
  return result
}

const MAX_LONG_ID = '9223372036854775807'

const isPureLongId = value => {
  const normalized = String(value ?? '').trim()
  if (!/^\d+$/.test(normalized)) return false

  const significantDigits = normalized.replace(/^0+/, '') || '0'
  return significantDigits.length < MAX_LONG_ID.length
    || (significantDigits.length === MAX_LONG_ID.length && significantDigits <= MAX_LONG_ID)
}

const isFirstLevelFolder = folder => folder?.folder === true
  && Number(folder.level || 1) === 1
  && (folder.parentId === null || folder.parentId === undefined)

const isCreateableFirstLevelFolder = folder => isFirstLevelFolder(folder)
  && isPureLongId(folder.id)
  && folder.isGroup !== true
  && folder.synthetic !== true
  && folder.canCreate === true

const firstLevelFolders = computed(() => flattenFolders(folderTreeFolders.value)
  .filter(isCreateableFirstLevelFolder)
  .map(folder => ({ value: folder.id, label: folder.name || folder.originalName || `文件夹 ${folder.id}` })))

const findRealFolderById = id => {
  if (!isPureLongId(id)) return null
  const normalizedId = String(id).trim()
  return flattenFolders(folderTreeFolders.value)
    .find(folder => folder?.folder === true && isPureLongId(folder.id) && String(folder.id).trim() === normalizedId) || null
}

const isDescendantFolder = (candidateId, ancestorId) => {
  let current = flattenFolders(folderTreeFolders.value)
    .find(folder => String(folder.id) === String(candidateId))
  const visited = new Set()
  while (current && current.parentId !== null && current.parentId !== undefined) {
    if (visited.has(String(current.id))) return false
    visited.add(String(current.id))
    if (String(current.parentId) === String(ancestorId)) return true
    current = flattenFolders(folderTreeFolders.value)
      .find(folder => String(folder.id) === String(current.parentId))
  }
  return false
}

const moveFolderTargets = computed(() => {
  const source = actionFolder.value
  const targets = [{ value: null, label: '根目录' }]
  if (!source) return targets

  const firstLevelTargets = flattenFolders(folderTreeFolders.value)
    .filter(folder => Number(folder.level || 1) === 1)
    .filter(folder => folder.parentId === null || folder.parentId === undefined)
    .filter(folder => folder.canManage === true)
    .filter(folder => String(folder.id) !== String(source.id))
    .filter(folder => !isDescendantFolder(folder.id, source.id))
    .filter(folder => folder.visibility === source.visibility)
    .filter(folder => source.visibility === 'PUBLIC'
      || folder.userId === undefined || String(folder.userId) === String(source.userId))
    .map(folder => ({
      value: folder.id,
      label: folder.name || folder.originalName || `文件夹 ${folder.id}`
    }))
  return targets.concat(firstLevelTargets)
})

const batchMoveTargets = computed(() => {
  const currentId = currentParentId.value
  const isSameDirectory = targetId => {
    const resolvedTargetId = targetId === BATCH_MOVE_ROOT_VALUE ? null : targetId
    return String(resolvedTargetId ?? '') === String(currentId ?? '')
  }
  const targets = [{
    value: BATCH_MOVE_ROOT_VALUE,
    label: '根目录',
    disabled: currentId === null || currentId === undefined
  }]
  const selectedFiles = fileList.value.filter(file => selectedIds.value
    .some(id => String(id) === String(file.id)))
  const selectedVisibility = selectedFiles.length > 0
    && new Set(selectedFiles.map(file => file.visibility)).size === 1
    ? selectedFiles[0].visibility
    : null
  const folderTargets = flattenFolders(folderTreeFolders.value)
    .filter(folder => folder?.folder !== false)
    .filter(folder => folder.canUpload === true)
    .filter(folder => !selectedVisibility || folder.visibility === selectedVisibility)
    .filter(folder => !selectedVisibility || selectedVisibility === 'PUBLIC'
      || selectedFiles.every(file => String(folder.userId) === String(file.userId)))
    .map(folder => ({
      value: folder.id,
      label: `${folder.level === 2 ? '　└ ' : ''}${folder.name || folder.originalName || `文件夹 ${folder.id}`}`,
      disabled: isSameDirectory(folder.id)
    }))
  return targets.concat(folderTargets)
})

const getRowCheckProps = ({ row } = {}) => ({
  disabled: batchMoving.value || batchDeleting.value || deletingIds.value.length > 0
    || (row?.canDelete !== true && row?.canMove !== true)
})

const contextMenuPosition = reactive({ left: 0, top: 0 })

const captureContextMenu = event => {
  contextMenuPosition.left = event.clientX
  contextMenuPosition.top = event.clientY
}

const contextMenuPopupProps = {
  onVisibleChange: (visible, context) => {
    if (visible && context?.e) {
      contextMenuPosition.left = context.e.clientX
      contextMenuPosition.top = context.e.clientY
    }
  },
  popperOptions: {
    strategy: 'fixed',
    modifiers: [
      {
        name: 'farm-context-menu-position',
        enabled: true,
        phase: 'beforeWrite',
        fn: ({ state }) => {
          const width = state.rects.popper.width || 0
          const height = state.rects.popper.height || 0
          const left = Math.min(contextMenuPosition.left, window.innerWidth - width - 8)
          const top = Math.min(contextMenuPosition.top, window.innerHeight - height - 8)
          state.styles.popper = {
            ...state.styles.popper,
            left: `${Math.max(8, left)}px`,
            top: `${Math.max(8, top)}px`,
            transform: 'none'
          }
        }
      }
    ]
  }
}

const getContextMenuOptions = file => {
  if (!file) return []

  const options = [{ content: '查看详情', value: 'detail', prefixIcon: renderIcon(Document) }]
  if (file.canPrint === true) options.push({ content: '打印', value: 'print', prefixIcon: renderIcon(Printer) })
  if (file.canDownload === true) options.push({ content: '下载', value: 'download', prefixIcon: renderIcon(Download) })
  if (file.canDelete === true) options.push({ content: '删除', value: 'delete', theme: 'error', prefixIcon: renderIcon(Delete) })

  if (selectedIds.value.includes(file.id) && selectedIds.value.length > 1 && canBatchDelete.value) {
    options.push({
      content: `批量删除 (${selectedIds.value.length})`,
      value: 'batch-delete',
      theme: 'error',
      prefixIcon: renderIcon(Delete)
    })
  }

  return options
}

const hasValue = value => value !== undefined && value !== null && value !== ''

const getFileNameLabel = value => String(value || '未命名文件')

const formatMetric = (value, suffix = '') => hasValue(value) ? `${value}${suffix}` : '-'

const restoreFileDetailContext = () => {
  const fileId = sessionStorage.getItem(FILE_DETAIL_CONTEXT_KEY)
  if (!fileId || selectedFile.value) return

  const file = fileList.value.find(item => String(item.id) === fileId)
  if (file) openFileDetail(file)
}

// ============ 方法定义 ============

/**
 * 为当前文件页补齐短期缩略图 URL。列表请求和缩略图请求共用序列号，
 * 避免翻页或搜索后旧页的异步结果回写到新页。
 */
const loadListThumbnails = async (records, requestSequence) => {
  const thumbnailRecords = records.filter(file => file?.id !== undefined && file?.id !== null)
  if (!thumbnailRecords.length) return

  const thumbnailResults = await Promise.allSettled(
    thumbnailRecords.map(file => Promise.resolve().then(() => getThumbnailUrl(file.id)))
  )
  if (requestSequence !== fileRequestSequence) return

  const thumbnailById = new Map(thumbnailRecords.map((file, index) => [
    String(file.id),
    thumbnailResults[index]
  ]))
  fileList.value = fileList.value.map(file => {
    const result = thumbnailById.get(String(file.id))
    if (!result) return file
    return {
      ...file,
      thumbnailUrl: result.status === 'fulfilled' ? result.value?.data || null : null
    }
  })
}

// 后端通过 folder=false 保证右侧只返回当前目录的直接文件。
const fileRows = computed(() => fileList.value)
const currentFolder = computed(() => flattenFolders(folderTreeFolders.value)
  .find(folder => String(folder.id) === String(currentParentId.value)))
const canUpload = computed(() => directoryReady.value && currentFolder.value?.canUpload === true)
const canCreateFolder = computed(() => currentParentId.value === null || currentParentId.value === undefined
  ? directoryReady.value
  : currentFolder.value?.canCreate === true)
const canBatchDelete = computed(() => selectedIds.value.length > 0
  && fileList.value.filter(file => selectedIds.value.includes(file.id)).every(file => file.canDelete === true))
const canBatchMove = computed(() => selectedIds.value.length > 0
  && fileList.value.filter(file => selectedIds.value.includes(file.id)).every(file => file.canMove === true))

/**
 * 获取文件列表
 */
const fetchData = async ({ preserveSelectedIds = [] } = {}) => {
  const requestSequence = ++fileRequestSequence
  loading.value = true
  loadError.value = ''
  try {
    const params = {
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      fileName: searchKeyword.value || undefined,
      parentId: currentParentId.value,
      folder: false
    }
    const res = await getFileList(params)
    if (requestSequence !== fileRequestSequence) return
    const records = res.data?.records || []
    fileList.value = records.map(file => ({
      ...file,
      thumbnailUrl: file.thumbnailUrl || null
    }))
    pagination.total = res.data?.total || 0

    const selectedSet = new Set((Array.isArray(preserveSelectedIds) ? preserveSelectedIds : [])
      .map(id => String(id)))
    selectedIds.value = fileList.value
      .map(item => item.id)
      .filter(id => selectedSet.has(String(id)))
    restoreFileDetailContext()
    void loadListThumbnails(fileList.value, requestSequence).catch(error => {
      // 单项缩略图失败由 Promise.allSettled 转为占位图；这里只保护意外的整体异常。
      console.error('获取文件列表缩略图失败:', error)
    })
  } catch (error) {
    if (requestSequence !== fileRequestSequence) return
    console.error('获取文件列表失败:', error)
    loadError.value = error?.message || '文件列表加载失败，请重试'
    message.error('获取文件列表失败')
  } finally {
    if (requestSequence === fileRequestSequence) loading.value = false
  }
}

const refreshLibrary = () => fetchData()
const refreshLibraryPreservingSelection = ids => fetchData({ preserveSelectedIds: ids })

const handleFolderSelect = selection => {
  let nextParentId = null
  if (selection !== null && selection !== undefined) {
    const selectedId = selection.id
    if (selectedId !== null && selectedId !== undefined && selectedId !== '') {
      const folder = findRealFolderById(selectedId)
      if (!folder) return
      nextParentId = String(folder.id)
    }
  }
  if (String(currentParentId.value) === String(nextParentId)) return
  currentParentId.value = nextParentId
  pagination.pageNum = 1
  searchKeyword.value = ''
  selectedIds.value = []
  batchMoveResults.value = []
  fetchData()
}

const handleFolderTreeLoaded = folders => {
  const wasDirectoryReady = directoryReady.value
  folderTreeFolders.value = Array.isArray(folders) ? folders : []
  directoryReady.value = true
  if (wasDirectoryReady || (currentParentId.value !== null && currentParentId.value !== undefined)) return

  const currentUserId = userStore.userInfo?.id ?? null
  const defaultFolder = currentUserId === null || currentUserId === undefined
    ? null
    : flattenFolders(folderTreeFolders.value)
      .find(folder => folder?.isDefault && folder.visibility !== 'PUBLIC' && String(folder.userId) === String(currentUserId))
  if (defaultFolder && isPureLongId(defaultFolder.id)) {
    currentParentId.value = defaultFolder.id
    pagination.pageNum = 1
    selectedIds.value = []
    fetchData()
  }
}

/**
 * 打开新建文件夹对话框
 */
const openCreateFolderDialog = () => {
  if (!canCreateFolder.value) {
    message.warning('当前目录不允许创建子目录')
    return
  }
  folderForm.name = ''
  folderForm.level = 1
  folderForm.parentId = null
  folderForm.visibility = 'PRIVATE'
  createFolderDialogVisible.value = true
}

/**
 * 创建文件夹
 */
const handleCreateFolder = async () => {
  const validation = await folderFormRef.value?.validate()
  if (validation !== true && validation !== undefined) return

  if (Number(folderForm.level) === 1) {
    if (folderForm.parentId !== null && folderForm.parentId !== undefined && folderForm.parentId !== '') {
      message.warning('一级目录不能选择父目录')
      return
    }
  } else if (Number(folderForm.level) === 2) {
    const parentFolder = findRealFolderById(folderForm.parentId)
    if (!isCreateableFirstLevelFolder(parentFolder)) {
      message.warning('请选择可创建二级目录的一级父目录')
      return
    }
  } else {
    message.warning('请选择有效的目录级别')
    return
  }

  const parentFolder = Number(folderForm.level) === 2
    ? findRealFolderById(folderForm.parentId)
    : null
  const visibility = Number(folderForm.level) === 2
    ? (parentFolder.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE')
    : folderForm.visibility
  creatingFolder.value = true

  try {
    await createFolder({
      parentId: Number(folderForm.level) === 2 ? parentFolder.id : null,
      folderName: folderForm.name,
      visibility
    })
    message.success('文件夹创建成功')
    createFolderDialogVisible.value = false
    await folderTreeRef.value?.refresh()
    await refreshLibrary()
  } catch (error) {
    console.error('创建文件夹失败:', error)
    message.error(error?.message || '创建文件夹失败')
  } finally {
    creatingFolder.value = false
  }
}

const handleFolderAction = (folder, action) => {
  if (!folder || folder.canManage !== true || folderActionLoading.value) return
  actionFolder.value = folder
  if (action === 'rename') {
    renameFolderForm.name = folder.name || folder.originalName || ''
    renameFolderDialogVisible.value = true
  } else if (action === 'move') {
    moveFolderForm.parentId = null
    moveFolderDialogVisible.value = true
  } else if (action === 'delete') {
    handleFolderDelete(folder)
  }
}

const handleRenameFolder = async () => {
  const folder = actionFolder.value
  if (!folder || folderActionLoading.value) return
  const validation = await renameFolderFormRef.value?.validate()
  if (validation !== true && validation !== undefined) return

  folderActionLoading.value = true
  try {
    await renameFolder(folder.id, { folderName: renameFolderForm.name })
    renameFolderDialogVisible.value = false
    await folderTreeRef.value?.refresh()
    await refreshLibrary()
    message.success('文件夹重命名成功')
  } catch (error) {
    console.error('重命名文件夹失败:', error)
    message.error(error?.message || '文件夹重命名失败')
  } finally {
    folderActionLoading.value = false
  }
}

const handleMoveFolder = async () => {
  const folder = actionFolder.value
  if (!folder || folderActionLoading.value) return
  if (String(moveFolderForm.parentId ?? '') === String(folder.parentId ?? '')) {
    message.warning('文件夹已经位于该目录')
    return
  }

  folderActionLoading.value = true
  const isCurrentFolder = String(currentParentId.value) === String(folder.id)
  const targetParentId = moveFolderForm.parentId ?? null
  try {
    await moveFolder(folder.id, { parentId: targetParentId })
    moveFolderDialogVisible.value = false
    if (isCurrentFolder) {
      currentParentId.value = targetParentId
      pagination.pageNum = 1
      selectedIds.value = []
    }
    await folderTreeRef.value?.refresh()
    await refreshLibrary()
    message.success('文件夹移动成功')
  } catch (error) {
    console.error('移动文件夹失败:', error)
    message.error(error?.message || '文件夹移动失败')
  } finally {
    folderActionLoading.value = false
  }
}

/**
 * 删除文件夹：确认、专用接口调用和目录/文件列表同步均由文件库统一处理。
 */
const handleFolderDelete = async folder => {
  const id = folder?.id
  if (id === null || id === undefined || deletingFolderId.value !== null
    || batchDeleting.value || deletingIds.value.length > 0 || folderActionLoading.value) return
  if (folder.isDefault) {
    message.warning('默认目录不可删除')
    return
  }

  try {
    await confirmMessage(
      `确定删除文件夹“${folder.name || folder.originalName || id}”吗？仅删除空文件夹，不会删除其中的文件；非空目录会被拒绝。`,
      '删除文件夹',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch (error) {
    if (error !== 'cancel') console.error('确认删除文件夹失败:', error)
    return
  }

  deletingFolderId.value = id
  folderActionLoading.value = true
  const isCurrentFolder = String(currentParentId.value) === String(id)
  try {
    await deleteFolder(id)
    if (isCurrentFolder) {
      currentParentId.value = folder.parentId ?? null
      pagination.pageNum = 1
      selectedIds.value = []
    }
    await folderTreeRef.value?.refresh()
    await refreshLibrary()
    message.success('文件夹删除成功')
  } catch (error) {
    console.error('删除文件夹失败:', error)
    message.error(error?.message || '删除文件夹失败')
  } finally {
    deletingFolderId.value = null
    folderActionLoading.value = false
  }
}

/**
 * 搜索处理
 */
const handleSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  pagination.pageNum = 1
  fetchData()
}

watch(searchKeyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  pagination.pageNum = 1
  searchTimer = setTimeout(() => {
    searchTimer = null
    fetchData()
  }, 300)
})

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
  selectedIds.value = selection.map(item => item.id)
}

const createUploadFileState = file => ({
  file,
  progress: 0,
  loaded: 0,
  status: 'pending',
  message: '',
  result: null
})

const isUploadCanceled = error => (
  error?.name === 'CanceledError' || error?.name === 'AbortError' || error?.code === 'ERR_CANCELED'
)

const updateUploadOverallProgress = () => {
  const states = uploadFileStates.value
  if (states.length > 0 && states.every(state => state.status === 'success')) {
    uploadProgress.value = 100
    return
  }
  const totalBytes = states.reduce((total, state) => total + (Number(state.file?.size) || 0), 0)
  if (totalBytes === 0) {
    uploadProgress.value = states.length
      ? Math.round(states.reduce((total, state) => total + state.progress, 0) / states.length)
      : 0
    return
  }

  const loadedBytes = states.reduce((total, state) => (
    total + (Number(state.file?.size) || 0) * (Math.max(0, Math.min(100, state.progress)) / 100)
  ), 0)
  uploadProgress.value = Math.min(Math.round((loadedBytes / totalBytes) * 100), 99)
}

/**
 * 选择批量上传文件
 */
const handleFileSelect = (files) => {
  if (batchUploading.value) return
  const selectedFiles = (Array.isArray(files) ? files : [files])
    .map(file => file?.raw || file)
    .filter(Boolean)
  const existingNames = fileList.value.map(item => item.originalName)
  const validation = validateBatchUploadSelection(selectedFiles, existingNames)
  pendingUploadFiles.value = validation.files
  uploadFileStates.value = validation.files.map(createUploadFileState)
  batchUploadResults.value = []
  uploadError.value = validation.rejected.map(item => item.reason).join('；')
  uploadProgress.value = 0
  if (validation.rejected.length > 0) {
    message.warning(`已忽略 ${validation.rejected.length} 个不可上传文件`)
  }
}

const submitBatchUpload = async () => {
  if (batchUploading.value || pendingUploadFiles.value.length === 0) return
  if (!canUpload.value) {
    message.warning('文件夹尚未就绪，请先选择目录')
    return
  }

  const files = pendingUploadFiles.value.slice()
  uploadFileStates.value = files.map(file => {
    const previousState = uploadFileStates.value.find(state => state.file === file)
    return previousState
      ? { ...previousState, progress: 0, loaded: 0, status: 'pending', message: '', result: null }
      : createUploadFileState(file)
  })
  batchUploading.value = true
  uploadError.value = ''
  uploadProgress.value = 0
  uploadController = new AbortController()
  try {
    const queueResults = await runUploadQueue(files, async (file, index) => {
      const state = uploadFileStates.value[index]
      state.status = 'uploading'
      const formData = new FormData()
      formData.append('file', file)
      if (currentParentId.value !== null) formData.append('parentId', String(currentParentId.value))
      try {
        const response = await uploadPrintFile(formData, event => {
          const total = Number(event?.total) || Number(file.size) || 0
          state.loaded = Number(event?.loaded) || 0
          if (total > 0) state.progress = Math.min(Math.round((state.loaded / total) * 100), 99)
          updateUploadOverallProgress()
        }, { signal: uploadController.signal })
        const item = {
          index,
          fileId: response.data?.id ?? null,
          fileName: response.data?.originalName || file.name,
          status: 'SUCCESS',
          errorCode: null,
          message: '上传成功',
          retryable: false,
          requiresRefresh: false
        }
        state.progress = 100
        state.loaded = Number(file.size) || state.loaded
        state.status = 'success'
        state.message = item.message
        state.result = item
        uploadProgress.value = files.every(currentFile => (
          uploadFileStates.value.find(currentState => currentState.file === currentFile)?.status === 'success'
        )) ? 100 : uploadProgress.value
        updateUploadOverallProgress()
        return item
      } catch (error) {
        if (!isUploadCanceled(error)) {
          const failure = getUploadFailureState(error)
          state.status = failure.requiresRefresh ? 'unknown' : 'failed'
          state.message = failure.message
          state.result = {
            index,
            fileId: null,
            fileName: file.name,
            status: 'FAILED',
            ...failure
          }
        }
        throw error
      }
    }, {
      concurrency: 3,
      signal: uploadController.signal
    })

    const result = {
      items: queueResults.map((queueResult, index) => {
        if (queueResult.status === 'fulfilled') return queueResult.value
        const file = files[index]
        const failure = getUploadFailureState(queueResult.reason)
        const state = uploadFileStates.value[index]
        state.status = failure.requiresRefresh ? 'unknown' : 'failed'
        state.message = failure.message
        state.result = {
          index,
          fileId: null,
          fileName: file.name,
          status: 'FAILED',
          ...failure
        }
        return state.result
      })
    }

    const items = normalizeBatchUploadResult(result).items
    batchUploadResults.value = items
    const successfulItems = items.filter(isBatchUploadSuccess)
    const retryableFiles = items
      .filter(item => !isBatchUploadSuccess(item) && item.retryable)
      .map(item => files[item.index])
      .filter(Boolean)
    const unknownResultCount = items.filter(item => item.requiresRefresh).length
    pendingUploadFiles.value = retryableFiles
    const allUploadFileStates = uploadFileStates.value.slice()
    uploadFileStates.value = retryableFiles.map(file => {
      const state = allUploadFileStates.find(item => item.file === file)
      return state
        ? { ...state, progress: 0, loaded: 0, status: 'pending', message: '', result: null }
        : createUploadFileState(file)
    })
    if (unknownResultCount) {
      uploadError.value = '部分上传结果未知，请刷新文件列表确认后再重试，避免重复入库'
    }

    if (successfulItems.length > 0 || unknownResultCount) await refreshLibrary()
    if (retryableFiles.length === 0 && successfulItems.length === files.length) {
      message.success(`已上传 ${successfulItems.length} 个文件`)
      uploadDialogVisible.value = false
      pendingUploadFiles.value = []
    } else if (successfulItems.length > 0) {
      const suffix = unknownResultCount ? '，部分结果未知，请刷新确认' : ''
      message.warning(`已上传 ${successfulItems.length} 个文件，${files.length - successfulItems.length} 个失败${suffix}`)
    } else {
      message.error(unknownResultCount ? '上传结果未知，请刷新文件列表确认' : '文件上传失败，请检查失败项')
    }
  } catch (error) {
    console.error('批量上传失败:', error)
    if (isUploadCanceled(error)) {
      const completedItems = uploadFileStates.value
        .filter(state => state.status === 'success' && state.result)
        .map(state => state.result)
      const completedFiles = new Set(uploadFileStates.value
        .filter(state => state.status === 'success')
        .map(state => state.file))
      batchUploadResults.value = completedItems
      pendingUploadFiles.value = files.filter(file => !completedFiles.has(file))
      uploadFileStates.value = uploadFileStates.value
        .filter(state => !completedFiles.has(state.file))
        .map(state => ({ ...state, progress: 0, loaded: 0, status: 'pending', message: '', result: null }))
      message.info('上传已取消')
    } else {
      const failure = getUploadFailureState(error)
      uploadError.value = failure.message
      if (failure.requiresRefresh) message.warning(failure.message)
      else message.error(failure.message)
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
  if (file.canDelete !== true) {
    message.warning('当前文件不允许删除')
    return
  }

  try {
    await confirmMessage('确定要删除吗？', '提示', {
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
      message.error(error?.message || '删除失败')
    }
  } finally {
    deletingIds.value = deletingIds.value.filter(item => String(item) !== String(id))
  }
}

/** 打开批量移动文件对话框，仅使用当前页已选文件。 */
const openBatchMoveDialog = () => {
  if (batchMoving.value || batchDeleting.value || deletingIds.value.length > 0) return
  if (selectedIds.value.length === 0) {
    message.warning('请先选择要移动的文件')
    return
  }
  if (!canBatchMove.value) {
    message.warning('所选文件包含不可移动的资源')
    return
  }
  batchMoveForm.parentId = ''
  batchMoveResults.value = []
  batchMoveError.value = ''
  batchMoveDialogVisible.value = true
}

/** 批量移动文件，部分失败时保留失败项选择并在对话框中展示逐项原因。 */
const handleBatchMove = async () => {
  if (batchMoving.value || batchDeleting.value || deletingIds.value.length > 0) return
  if (selectedIds.value.length === 0) {
    message.warning('请先选择要移动的文件')
    return
  }

  const ids = selectedIds.value.slice()
  if (batchMoveForm.parentId === '' || batchMoveForm.parentId === null || batchMoveForm.parentId === undefined) {
    message.warning('请选择目标目录')
    return
  }

  const targetParentId = batchMoveForm.parentId === BATCH_MOVE_ROOT_VALUE
    ? null
    : batchMoveForm.parentId
  if (String(targetParentId ?? '') === String(currentParentId.value ?? '')) {
    message.warning('目标目录与当前目录相同，无需移动')
    return
  }

  batchMoving.value = true
  batchMoveError.value = ''
  try {
    const response = await moveBatchFiles(ids, targetParentId)
    const items = Array.isArray(response.data?.items) ? response.data.items : []
    if (items.length !== ids.length) {
      batchMoveError.value = '批量移动结果不完整，请刷新后重试未确认的项目'
      message.warning(batchMoveError.value)
      await folderTreeRef.value?.refresh()
      await refreshLibraryPreservingSelection(ids)
      return
    }

    batchMoveResults.value = items
    const failedItems = items.filter(item => !item.success)
    const successItems = items.filter(item => item.success)
    const failedIds = failedItems.map(item => item.id)
    selectedIds.value = failedIds

    await folderTreeRef.value?.refresh()
    await refreshLibraryPreservingSelection(failedIds)
    if (failedItems.length > 0) {
      const reasons = failedItems.map(item => `${item.id}: ${item.reason || '移动失败'}`).join('；')
      message.warning(`已移动 ${successItems.length} 项，${failedItems.length} 项失败：${reasons}`)
    } else {
      message.success(`批量移动成功，共 ${successItems.length} 项`)
      batchMoveDialogVisible.value = false
    }
  } catch (error) {
    console.error('批量移动失败:', error)
    message.error(error?.message || '批量移动失败')
  } finally {
    batchMoving.value = false
  }
}

/**
 * 批量删除
 */
const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0 || batchDeleting.value || deletingIds.value.length > 0) return
  if (!canBatchDelete.value) {
    message.warning('所选文件包含不可删除的资源')
    return
  }
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
      await refreshLibraryPreservingSelection(ids)
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
    await refreshLibraryPreservingSelection(failedItems.map(item => item.id))
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
  if (file?.canPrint !== true) {
    message.warning('当前文件不允许创建打印任务')
    return
  }
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
  if (file?.canPrint !== true) {
    message.warning('当前文件不允许创建打印任务')
    return
  }
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
  if (!canUpload.value) {
    message.warning('文件夹尚未就绪，请先选择目录')
    return
  }
  pendingUploadFiles.value = []
  uploadFileStates.value = []
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
 * 获取成功率标签主题：无数据或 0 为 default，低于 50% 为 danger，
 * 50%（含）至 80%（不含）为 warning，80% 及以上为 success。
 */
const getSuccessRateTheme = (successRate) => {
  const rate = Number(successRate)
  if (!Number.isFinite(rate) || rate <= 0) return 'default'
  if (rate < 50) return 'danger'
  if (rate < 80) return 'warning'
  return 'success'
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
  if (file.canDownload !== true) {
    message.warning('当前文件不允许下载')
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
  openFileDetail(file)
}

const handleContextMenuClick = (value, file) => {
  if (!file) return

  const action = typeof value === 'object' ? value.value : value

  switch (action) {
    case 'detail':
      openFileDetail(file)
      break
    case 'print':
      handlePrint(file)
      break
    case 'download':
      handleFileDownload(file)
      break
    case 'delete':
      handleDelete(file.id)
      break
    case 'batch-delete':
      handleBatchDelete()
      break
    default:
      break
  }
}

/**
 * 处理表格行点击事件
 */
const handleTableRowClick = (row) => {
  openFileDetail(row)
}

// ============ 生命周期 ============
onMounted(() => {
  refreshLibrary()
})

onBeforeUnmount(() => {
  fileRequestSequence += 1
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<style scoped>
/* The file workspace has one canonical visual system and one result scroll region. */
.file-library-page {
  gap: var(--app-spacing-4);
}

.file-library-layout {
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  gap: var(--app-spacing-4);
}

.file-library-sidebar {
  display: flex;
  flex: 0 0 210px;
  width: 210px;
  min-width: 210px;
  max-width: 210px;
  box-sizing: border-box;
  align-items: stretch;
  min-height: 0;
  overflow: hidden;
}

.file-library-content {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.file-library-sidebar-card {
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  align-items: stretch;
  overflow: hidden;
}

.file-library-sidebar-card :deep(.t-card__body) {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  padding: 0;
}

.file-library-toolbar-card {
  flex: 0 0 auto;
  min-width: 0;
}

.file-library-toolbar-card :deep(.t-card__body) {
  padding: var(--app-spacing-3) var(--app-spacing-4);
}

.file-library-results-card {
  display: flex;
  flex: 1 1 0%;
  height: 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.file-library-results-card :deep(.t-card__body) {
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 0;
  overflow: hidden;
}

.file-library-results-card :deep(.t-loading__parent) {
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.file-library-grid-card :deep(.t-card__body) {
  padding: var(--app-spacing-4);
}

.file-library-main :deep(.t-empty) {
  padding: var(--app-spacing-8) var(--app-spacing-4);
}

.file-library-main :deep(.t-alert) {
  flex: 0 0 auto;
}

.file-library-main {
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  gap: var(--app-spacing-4);
}

.file-library-filter-form {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: var(--app-spacing-4);
  margin: 0;
  padding: 0;
}

.file-library-toolbar-actions,
.file-library-search-actions {
  min-width: 0;
  flex-wrap: wrap;
}

.file-library-toolbar-actions {
  flex: 0 1 auto;
  width: max-content;
  max-width: 100%;
}

.file-library-search-actions {
  flex: 0 0 auto;
  width: max-content;
  max-width: 100%;
  justify-content: flex-end;
}

.file-library-search-input {
  flex: 0 0 220px;
  width: 220px;
  max-width: 100%;
  box-sizing: border-box;
}

.file-library-view-mode {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  width: max-content;
  max-width: 100%;
  height: var(--td-comp-size-m);
  padding: 2px;
  border-radius: var(--td-radius-medium);
}

.file-library-view-mode :deep(.t-radio-button) {
  display: inline-flex;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: calc(var(--td-comp-size-m) - 4px);
  padding: 0;
}

.file-library-view-mode :deep(.t-radio-button__label) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  line-height: 1;
}

.file-library-view-mode :deep(.t-radio-button__label > *) {
  margin: 0;
}

.file-library-search-input :deep(.t-input) {
  border-color: transparent;
  background: var(--app-surface-muted);
  box-shadow: none;
}

.file-library-search-input :deep(.t-input:hover) {
  border-color: transparent;
  background: var(--td-bg-color-container-hover);
}

.file-library-search-input :deep(.t-input:focus-within) {
  border-color: transparent;
  box-shadow: 0 0 0 2px var(--td-brand-color-2);
}

.file-library-filter-form :deep(.t-space-item) {
  min-width: 0;
}

.file-library-filter-form :deep(.t-button) {
  flex: 0 0 auto;
  height: var(--td-comp-size-m);
  white-space: nowrap;
}

.file-library-filter-form :deep(.t-input__wrap) {
  min-width: 0;
}

.file-library-filter-form :deep(.t-input) {
  min-width: 0;
}

.file-library-status-region,
.file-library-empty {
  display: flex;
  flex: 1 1 0%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}

.file-table-view {
  display: flex;
  flex: 1 1 0%;
  flex-direction: column;
  width: 100%;
  height: 100%;
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

.file-table-view :deep(.t-table) {
  min-width: 1000px;
  table-layout: fixed;
}

.file-table-view :deep(.t-table__header > tr > th) {
  height: 40px;
  padding: 0 10px;
  color: var(--td-text-color-primary);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  background: var(--td-bg-color-secondarycontainer);
  border-bottom: 1px solid var(--td-component-border);
}

.file-table-view :deep(.t-table__body > tr > td) {
  height: 48px;
  padding: 6px 10px;
  color: var(--td-text-color-primary);
  line-height: 1.3;
  white-space: nowrap;
  border-bottom: 1px solid var(--td-component-border);
}

.file-table-view :deep(.t-table__body > tr:last-child > td) {
  border-bottom: 1px solid var(--td-component-border);
}

.file-table-view :deep(.t-table__body > tr:hover > td) {
  background: var(--td-bg-color-container-hover);
}

:deep(.file-upload-dialog) {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 96px);
  overflow: hidden;
}

:deep(.file-upload-dialog .t-dialog__body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

:deep(.file-upload-dialog .t-dialog__footer) {
  flex: 0 0 auto;
}

.file-upload-dialog__content {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

:deep(.file-upload-dialog__upload) {
  flex: 0 0 auto;
  width: 100%;
}

:deep(.file-upload-dialog__upload .t-upload__dragger) {
  width: 100%;
  min-height: 112px;
  height: auto;
  box-sizing: border-box;
  padding: var(--app-spacing-5) var(--app-spacing-6);
}

.farm-upload__content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
  gap: var(--app-spacing-3);
}

.farm-icon--upload {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  color: var(--td-brand-color);
  font-size: 32px;
}

.farm-upload__text {
  min-width: 0;
  margin: 0;
  color: var(--td-text-color-primary);
  text-align: left;
}

.farm-upload__tip {
  margin-top: var(--app-spacing-2);
  color: var(--td-text-color-secondary);
  text-align: center;
}

.file-upload-dialog__file-list {
  flex: 1 1 auto;
  min-height: 0;
  max-height: min(320px, calc(100vh - 300px));
  margin-top: var(--app-spacing-4);
  overflow-y: auto;
  padding: 0 var(--app-spacing-1) var(--app-spacing-1) 0;
  scrollbar-color: var(--app-scrollbar-thumb) var(--app-scrollbar-track);
  scrollbar-width: thin;
}

.file-upload-dialog__file-list::-webkit-scrollbar {
  width: 8px;
}

.file-upload-dialog__file-list::-webkit-scrollbar-track {
  background: var(--app-scrollbar-track);
}

.file-upload-dialog__file-list::-webkit-scrollbar-thumb {
  background: var(--app-scrollbar-thumb);
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}

.file-upload-dialog__section + .file-upload-dialog__section {
  margin-top: var(--app-spacing-4);
}

.file-upload-dialog__section-title {
  margin-bottom: var(--app-spacing-2);
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}

.file-upload-dialog__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: var(--app-spacing-3);
  padding: var(--app-spacing-1) 0;
  color: var(--td-text-color-primary);
  font: var(--td-font-body-small);
}

.file-upload-dialog__item-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-upload-dialog__item-name-tooltip,
.create-job-file-name-tooltip {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.file-upload-dialog__item-name-tooltip {
  flex: 1 1 auto;
}

.create-job-file-name-tooltip {
  display: block;
  width: 100%;
}

.file-upload-dialog__item-progress {
  display: inline-flex;
  flex: 0 0 180px;
  align-items: center;
  gap: var(--app-spacing-2);
}

.file-upload-dialog__item-progress :deep(.t-progress) {
  flex: 1 1 auto;
  min-width: 0;
}

.file-upload-dialog__item-status {
  flex: 0 0 auto;
  color: var(--td-text-color-secondary);
  white-space: nowrap;
}

.file-upload-dialog__error {
  flex: 0 0 auto;
  margin-top: var(--app-spacing-3);
}

.file-upload-dialog__footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--app-spacing-2);
}

:deep(.create-folder-dialog),
:deep(.create-job-dialog) {
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow: hidden;
}

:deep(.create-folder-dialog .t-dialog__body),
:deep(.create-job-dialog .t-dialog__body) {
  min-width: 0;
  max-width: 100%;
  overflow-y: auto;
}

.create-folder-form,
.create-job-form {
  width: 100%;
  min-width: 0;
}

.create-folder-form {
  width: min(100%, 320px);
  margin: 0 auto;
}

.create-folder-form__control,
.create-job-form__control {
  width: 100%;
  min-width: 0;
}

.create-folder-form :deep(.t-form__item),
.create-job-form__fields :deep(.t-form__item) {
  margin-bottom: var(--app-spacing-4);
}

.create-folder-form :deep(.t-form__item:last-child),
.create-job-form__fields :deep(.t-form__item:last-child) {
  margin-bottom: 0;
}

.create-folder-form :deep(.t-input),
.create-folder-form :deep(.t-select),
.create-job-form__control :deep(.t-input),
.create-job-form__control :deep(.t-select) {
  width: 100%;
  min-width: 0;
}

.create-folder-form__control--level,
.create-job-form__control--priority {
  display: flex;
  justify-content: flex-start;
  min-width: 0;
}

.create-folder-form__control--level :deep(.t-radio-group),
.create-job-form__control--priority :deep(.t-radio-group) {
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
  max-width: 100%;
}

.create-folder-form__level-radio-group {
  gap: var(--app-spacing-2);
  min-width: 0;
}

.create-folder-form__level-radio-group :deep(.t-radio-button) {
  position: relative;
  z-index: 0;
  margin-left: 0;
  border-left: 1px solid var(--td-border-level-2-color);
  border-right: 1px solid var(--td-border-level-2-color);
  border-radius: var(--td-radius-medium);
}

.create-folder-form__level-radio-group :deep(.t-radio-button:first-child),
.create-folder-form__level-radio-group :deep(.t-radio-button:last-child) {
  border-radius: var(--td-radius-medium);
}

.create-folder-form__level-radio-group :deep(.t-radio-button.t-is-checked) {
  z-index: 1;
}

.create-folder-form__level-radio-group :deep(.t-radio-button.t-is-checked + .t-radio-button) {
  border-left: 1px solid var(--td-border-level-2-color);
}

.create-folder-dialog__footer,
.create-job-dialog__footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--app-spacing-3);
}

.create-job-form__file-summary {
  width: 100%;
  min-width: 0;
  margin-bottom: var(--app-spacing-5);
  padding: var(--app-spacing-4);
  box-sizing: border-box;
  background: var(--td-bg-color-secondarycontainer);
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
}

.create-job-form__file-summary-row {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  gap: var(--app-spacing-3);
}

.create-job-form__file-thumbnail {
  display: flex;
  flex: 0 0 48px;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  min-width: 0;
  overflow: hidden;
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-small);
}

.create-job-form__file-thumbnail-image,
.create-job-form__file-thumbnail-placeholder {
  width: 100%;
  height: 100%;
}

.create-job-form__file-thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.create-job-form__file-meta {
  flex: 1 1 auto;
  min-width: 0;
}

.create-job-form__file-label {
  margin-bottom: var(--app-spacing-1);
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}

.create-job-form__file-name {
  min-width: 0;
  overflow: hidden;
  color: var(--td-text-color-primary);
  font: var(--td-font-title-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-job-form__fields {
  width: min(100%, 360px);
  margin: 0 auto;
}

.create-job-form__copies {
  width: 100%;
}

.create-job-form__tip {
  display: block;
  width: 100%;
  min-width: 0;
  margin-top: var(--app-spacing-2);
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
  line-height: 1.5;
  white-space: normal;
  overflow-wrap: anywhere;
}

.create-job-form__select :deep(.t-select-input),
.create-job-form__select :deep(.t-input),
.create-job-form__select :deep(.t-input__inner),
.create-job-form__select :deep(.t-select-option),
.create-job-form__select :deep(.t-select-option > span) {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-grid-view {
  display: grid;
  flex: 1 1 0%;
  width: 100%;
  height: 100%;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: var(--app-spacing-3);
  align-content: start;
  min-height: 0;
  padding: 2px 2px var(--app-spacing-3);
  overflow-y: auto;
}

.file-card-context {
  min-width: 0;
  min-height: 0;
}

.file-card-context :deep(.t-card) {
  height: 100%;
}

.file-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
}

.file-card :deep(.t-card__body) {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
}

.file-card__selection {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
}

.file-card__media {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  height: 88px;
  flex-shrink: 0;
  background: var(--td-bg-color-container-hover);
  overflow: hidden;
}

.file-card__thumbnail {
  width: 100%;
  height: 100%;
}

.file-card__material-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  max-width: calc(100% - 16px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-card__media--folder {
  color: var(--app-primary);
  background: var(--td-brand-color-1);
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
  min-height: 124px;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
}

.file-card__name {
  margin: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-card__name-tooltip {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.file-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
  color: var(--app-text-secondary);
  font-size: 11px;
}

.file-card__metrics > div {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: var(--app-spacing-3);
  padding: 6px;
  color: var(--app-text-secondary);
  background: var(--app-surface-muted);
  border-radius: var(--app-radius-small);
}

.file-card__stats > div {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.file-card__stat-label {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.file-card__stat-value {
  flex: 0 0 auto;
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.file-card__success-rate {
  min-width: 0;
}

.file-card__success-rate-tooltip {
  display: block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
}

.file-card__success-rate-tag {
  display: block;
  flex: 0 1 auto;
  min-width: max-content;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-card__actions {
  display: flex;
  gap: 6px;
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
  padding-top: 0;
}

.file-table__name-cell {
  display: flex;
  align-items: center;
  gap: var(--app-spacing-2);
  width: 100%;
  min-width: 0;
}

.file-table__name-cell :deep(.t-dropdown__trigger) {
  display: block;
  min-width: 0;
  width: 100%;
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
  display: block;
  width: 100%;
  height: 100%;
}

.file-table__thumbnail :deep(.t-image__img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.file-table__name-tooltip {
  display: block;
  min-width: 0;
  flex: 1 1 auto;
  max-width: 100%;
  overflow: hidden;
}

.file-table__metric {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-table__metric-tooltip {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.file-table__type-tag {
  flex: 0 1 auto;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-table__type-tooltip,
.file-table__rate-tooltip {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.file-table__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-spacing-2);
  white-space: nowrap;
}

.file-table__rate-tag {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-move-dialog__results {
  max-height: min(240px, calc(100vh - 420px));
  margin-top: var(--app-spacing-4);
  overflow-y: auto;
  scrollbar-color: var(--app-scrollbar-thumb) var(--app-scrollbar-track);
  scrollbar-width: thin;
}

.file-move-dialog__result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-3);
  min-width: 0;
  padding: var(--app-spacing-2) 0;
  border-bottom: 1px solid var(--td-component-border);
  font: var(--td-font-body-small);
}

.file-move-dialog__result-id {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .file-library-filter-form {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .file-library-search-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .file-library-toolbar-actions {
    width: 100%;
  }

  .file-library-search-input {
    flex: 0 1 220px;
    width: min(220px, 100%);
  }
}

@media (max-width: 1024px) {
  .file-library-main {
    padding: 0;
  }

  .file-library-filter-form {
    gap: var(--app-spacing-2);
    margin: 0;
    padding: 0;
  }

}

@media (max-width: 640px) {
  .file-library-layout {
    flex-direction: column;
    overflow-y: auto;
  }

  .file-library-sidebar {
    flex: 0 0 240px;
    width: 100% !important;
    min-width: 0;
    max-width: 100%;
  }

  .file-library-content {
    flex: 1 1 auto;
    min-height: 420px;
  }

  .file-library-main {
    min-height: 420px;
  }

  .file-library-pagination {
    justify-content: center;
  }
}

</style>
