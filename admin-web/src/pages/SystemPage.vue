<template>
  <section class="page-section">
    <article class="panel-card">
      <div class="panel-head">
        <div>
          <div class="panel-kicker">系统说明</div>
          <h2>系统说明与迁移进度</h2>
        </div>
      </div>
      <div class="two-column">
        <div class="sub-panel">
          <h3>当前状态</h3>
          <ul class="conclusion-list">
            <li>Vue 3 管理端基础骨架已经就位。</li>
            <li>Vite 已代理 /api 到 http://localhost:8088。</li>
            <li>规则、通知、账户、分类、预算、交易都已迁入 Vue 页面。</li>
          </ul>
        </div>
        <div class="sub-panel">
          <h3>下一步</h3>
          <ul class="conclusion-list">
            <li>继续补齐剩余后台业务页与统一组件封装。</li>
            <li>逐步收口旧版静态后台页，减少双份前端维护成本。</li>
            <li>后续决定是否将 Vue 打包产物并入 Spring Boot 静态资源。</li>
          </ul>
        </div>
      </div>
    </article>
  </section>
</template>
