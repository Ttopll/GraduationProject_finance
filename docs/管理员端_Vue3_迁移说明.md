# 管理员端 Vue3 迁移说明

## 当前状态
- 已新增独立前端工程：`admin-web`
- 技术栈：`Vue 3 + Vue Router + Vite`
- Vite 已代理 `/api` 到 `http://localhost:8088`
- 旧版静态后台页仍保留，作为迁移期间的备用入口

## 已完成页面
- `/login`：独立登录页
- `/analysis`：真实数据导入、导入历史、答辩摘要
- `/family`：当前用户、家庭上下文、成员关系
- `/business`：账户 / 分类 / 预算 / 交易 标准表格 CRUD
- `/rules`：规则列表 / 通知中心 标准表格页
- `/system`：迁移状态说明页

## 本轮迁移结果
### 规则与通知
- 已迁入 Vue 3
- 已改成后台表格化列表页
- 已支持规则新增、编辑、启停、删除、执行评估
- 已支持通知查询、已读、全部已读、删除已读、单条删除

### 账户 / 分类 / 预算 / 交易
- 已迁入 Vue 3
- 已改成后台表格化列表页
- 已支持统一弹层表单
- 已支持账户新增、编辑、启停、删除
- 已支持交易筛选、预算使用情况、月度收支摘要

### 通用组件
- 已抽离通用表格卡片组件：`AdminTableCard.vue`
- 已抽离通用筛选条组件：`FilterBar.vue`
- 已抽离通用弹层表单组件：`CrudModal.vue`

## 本地运行方式
### 1. 启动后端
在项目根目录运行：

```powershell
./mvnw spring-boot:run
```

默认地址：
- `http://localhost:8088`

### 2. 启动 Vue 管理员端
进入前端目录：

```powershell
cd C:\Users\Ttop\codex_tmp_finance_verify_20260309_1\admin-web
```

首次安装依赖：

```powershell
npm install
```

启动开发环境：

```powershell
npm run dev
```

默认访问地址：
- `http://localhost:5173/login`

## 下一步建议
1. 继续补齐剩余后台业务页的 Vue 化迁移
2. 进一步抽离表格列配置、状态标签、批量操作组件
3. 衔接 Spring Boot 静态资源发布方案，决定是否正式替换旧版后台页
