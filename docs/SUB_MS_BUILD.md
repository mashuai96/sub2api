# sub_ms 构建与验证

适用版本：`2.20.1-riyue-ms.1`。本指南只构建和验证源码，不执行生产部署。

## 工具链

| 组件 | 要求 |
| --- | --- |
| Docker | 支持 BuildKit；本定制运行时镜像按 Linux amd64 验证 |
| Go | `backend/go.mod` 指定的 `1.27.3` |
| Node.js | 22 或更高；源码镜像使用 Node 24 |
| pnpm | 构建文件固定 `9.15.9`，依赖使用 `frontend/pnpm-lock.yaml` |
| UI 验证 | Playwright `1.62.1`，Chromium 或显式选择的浏览器 |

Go、Node 基础镜像标签仍可能更新；锁文件和固定运行时 digest 能约束来源，
但不承诺任意日期构建的镜像逐字节相同。正式发布应额外记录实际镜像 digest、
源提交、工具链版本、构建时间和构建结果。

## 从干净检出构建

在仓库根目录执行，以下示例使用 Bash：

```bash
docker build --platform linux/amd64 -f Dockerfile.sub-ms \
  --build-arg VERSION=2.20.1-riyue-ms.1 \
  --build-arg COMMIT="$(git rev-parse HEAD)" \
  --build-arg DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t sub2api:2.20.1-riyue-ms.1 .

docker run --rm --network none \
  --entrypoint /app/sub2api sub2api:2.20.1-riyue-ms.1 -version
```

构建过程包含：锁定依赖安装、前端国际化检查与类型检查、前端打包、后端嵌入
前端资源编译。无需本地 `.build/sub2api`、生产配置或运行中的数据库。

运行时复用固定 digest 的上游 `v2.20.1` 镜像，只替换应用二进制。
上游入口脚本、资源、健康检查和非 root 运行行为继续保留。
其他 CPU 架构需先确认基础镜像支持，再单独验证，不在本次验证声明内。

PowerShell 可先赋值 `$commit = git rev-parse HEAD` 与
`$date = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')`，
再将上面三个构建参数写为 `--build-arg VERSION=2.20.1-riyue-ms.1
--build-arg COMMIT=$commit --build-arg DATE=$date`，命令放在一行执行。

## 本地前端验证

```bash
cd frontend
corepack pnpm@9.15.9 install --frozen-lockfile
corepack pnpm@9.15.9 exec vitest run \
  src/components/admin/usage/__tests__ \
  src/views/admin/__tests__/UsageView.spec.ts
corepack pnpm@9.15.9 build
cd ..
```

`frontend` 的生产构建输出位于 `backend/internal/web/dist`，该目录的生成内容不提交。

## 后端定向回归

```bash
cd backend
go test -count=1 -timeout=10m ./internal/service \
  -run 'Test(SubMS|ResolveBillingServiceTier|ApplyServiceTierBillingResolution|OpenAIResponsesTTFT|OpenAIGatewayServiceRecordUsage_)'
go test -count=1 ./internal/pkg/openai ./internal/pkg/requesttiming
cd ..
```

测试通过不能代替完整环境验收。扩展测试可能依赖容器、fixture 路径、DNS 或
Python；记录实际失败原因，修复测试环境后复测，不跳过失败再宣称全部通过。
原发布验证覆盖范围见 [LOCAL_CHANGES.md](../LOCAL_CHANGES.md#release-verification)。

## 内建页面 UI 检查

先完成前端构建，再在仓库根目录执行：

```bash
npm install --prefix .build/usage-ui-deps --no-save --package-lock=false playwright@1.62.1
node .build/usage-ui-deps/node_modules/playwright/cli.js install chromium
PLAYWRIGHT_MODULE_PATH="$PWD/.build/usage-ui-deps/node_modules" \
  node scripts/verify-usage-ui.cjs
```

Linux CI 如缺少浏览器系统库，可使用 `install --with-deps chromium`。
脚本监听随机 localhost 端口，所有 API 使用虚构数据，外部请求被阻止；
不要求登录生产账号，也不触发真实模型请求。

- 覆盖用户与管理员两个入口、1440 / 768 / 390 / 320px 共八个场景。
- 检查延迟、TPS、缓存率、颜色边界、缺失值、布局重叠和浏览器错误。
- 默认输出 `.build/usage-ui/result.json` 和截图，均被 Git 忽略。
- `USAGE_UI_OUTPUT_DIR` 可设置另一个输出目录，避免覆盖已有验证证据。
- `PLAYWRIGHT_CHANNEL=msedge` 可选用已安装的 Edge；不设置时使用 Playwright Chromium。

## 部署边界

部署配置参考 [deploy/README.md](../deploy/README.md)，但应用镜像必须替换为自己
构建并验证的定制镜像。源码提交不会改变已有 Compose、反代、WAF 或容器。
本指南不提供自动连接服务器的部署脚本，也不发布凭据。

升级已有实例前应确认：

1. 记录运行镜像、配置和持久化目录，准备可恢复的备份与回退镜像。
2. 检查全部待执行的上游迁移，不假设所有环境都只差同一条迁移。
3. 验证数据库与 Redis 的混合版本兼容、鉴权、Fast 计费及用量计时。
4. 发布后检查实际构建版本与健康状态；失败时按已验证方案回退。
5. 清理仅针对明确审查过的旧构建产物，保留当前与可用回退镜像，不清理业务数据。

## CI 与版本发布

`.github/workflows/sub-ms.yml` 对 `main` 的推送与 PR 执行定向回归。
继承的上游工作流继续保留；`release.yml` 的发布入口限制在原上游仓库运行。
这里不自动推送容器镜像、发送上游通知或连接生产服务器。

源码版本使用带注释的 `v2.20.1-riyue-ms.1` 标签。后续版本需同步
`CHANGELOG.md`、默认构建版本和验证说明；不能只改标签而不核验实际源码。
