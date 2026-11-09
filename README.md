<div align="center">

<img src="assets/logo-icon.png" alt="Sub2API" width="96" />

# Sub2API · sub_ms

**面向用量可观测性与 API Key Fast 计费的独立维护分支**

基于 `ranxi2001/sub2api v2.20.1`，保留上游网关能力与安全修复，维护明确、可回归的差异。

[变更日志](CHANGELOG.md) · [构建与验证](docs/SUB_MS_BUILD.md) · [行为差异](LOCAL_CHANGES.md) · [问题反馈](https://github.com/mashuai96/sub2api/issues)

</div>

## 版本与来源

| 项目 | 内容 |
| --- | --- |
| 本仓库 | `mashuai96/sub2api` |
| 默认分支 | `main` |
| 当前定制版本 | `2.20.1-riyue-ms.2` |
| 上游基线 | [`ranxi2001/sub2api v2.20.1`](https://github.com/ranxi2001/sub2api/releases/tag/v2.20.1) |
| 基线提交 | `19555361324e8df0f4723cc564246a43100490a7` |
| 计时兼容参考 | `v2.19.4`，`7c57360065e6b181fbc0d5eb52cd037e7f437f1e` |

本仓库不是上游官方发布渠道。上游历史、许可证和第三方声明保留；具体差异以本仓库的代码、测试及版本说明为准。

## 本版改动

### 用量界面

用户 `/usage` 与管理员 `/admin/usage` 使用一致的表格组件：

- **延迟**：分别展示服务端首字与总耗时，配合两行状态条。
- **性能**：独立展示 TPS 与缓存命中率。
- 保留筛选、导出、分页、列显示偏好及用户可见性限制。
- 首字颜色阈值仍为 **10 / 30 / 60 秒**，总耗时仍为 **60 / 180 / 300 秒**。

列表首字和总耗时分别取记录中的 `first_token_ms` 和 `duration_ms`，不以含转发前等待或 SSE 首事件字段替换。TPS、缓存率公式不变。耗时弹框恢复 2.19.4 的布局，普通用户只查看自己记录已有的摘要，不获得管理员诊断权限。

### v2.19.4 首字口径

恢复 HTTP 原生与透传 Responses 的 v2.19.4 用量首字判定，保留已配置的可见输出模式。首 SSE 事件、首语义和首文字的详细观测仍独立记录，**不会用首元数据事件冒充用量首字**。

旧口径包含特定空 delta、output item 和终止事件，因此不能解释为“每条记录都等于首个可见字符”。本次不回写历史用量，也不回退新版传输、重试与安全修复。

### API Key Fast 计费

对 OpenAI API Key 上游账号，当最终实际出站请求为 `priority` / `fast`、而兼容上游响应 `default` 时，按出站 Fast 档位结算，并记录请求档位、上游观测档位和结算档位。

**这是本分支的计费政策，不代表上游实际提供了加速。** 上游原始响应不会被改成 Fast；运营者应向使用者说明这一政策。

| 条件 | 结算行为 |
| --- | --- |
| 实际出站 Fast，响应 `default` | 保留出站 Fast 档位 |
| 显式开启 `openai_response_tier_billing_enabled` | 优先遵循原有响应档位计费规则 |
| 上游明确返回 `flex` | 保留原有降档行为 |
| 普通请求或已被策略过滤的 Fast | 不自动升为 Fast |
| Free Fast、自定义价格、OAuth | 沿用原有规则 |

仅影响新请求，不重算历史账单。完整边界与测试位置见 [行为差异](LOCAL_CHANGES.md)。

## 构建与运行

本版本以源码交付；不要把上游 `latest` 镜像当成本定制版，也不要假设已有本仓库的公共镜像。

以下命令在 Bash 中执行，构建需要 Docker BuildKit 与依赖下载网络：

```bash
git clone https://github.com/mashuai96/sub2api.git
cd sub2api

docker build -f Dockerfile.sub-ms \
  --build-arg VERSION=2.20.1-riyue-ms.2 \
  --build-arg COMMIT="$(git rev-parse HEAD)" \
  --build-arg DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t sub2api:2.20.1-riyue-ms.2 .
```

`Dockerfile.sub-ms` 从当前源码构建前端和后端，运行时基于固定 digest 的上游镜像，保留其资源、入口脚本及非 root 用户行为。

新环境可参考 [部署文档](deploy/README.md) 配置 PostgreSQL、Redis、持久化目录与密钥，但必须把 Compose 的应用镜像替换为上面构建的定制镜像。上游安装脚本和默认镜像仍指向上游版本。不要直接用示例配置覆盖现有生产环境。

升级前确认数据库迁移、备份、混合版本兼容和可用回退镜像；回退应用二进制不会自动撤销数据库迁移。详见 [构建与验证](docs/SUB_MS_BUILD.md)。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [CHANGELOG.md](CHANGELOG.md) | 本分支版本、兼容性与行为变化 |
| [LOCAL_CHANGES.md](LOCAL_CHANGES.md) | 计时与计费契约、验证范围及限制 |
| [构建与验证](docs/SUB_MS_BUILD.md) | 干净检出构建、本地测试、离线 UI 检查 |
| [贡献指南](CONTRIBUTING.md) | 提交、复现、脱敏与审查要求 |
| [安全报告](SECURITY.md) | 漏洞与凭据处理边界 |
| [上游参考](README_UPSTREAM.md) | 上游功能与通用部署文档 |

英文与日文文档 [README_EN.md](README_EN.md)、[README_JA.md](README_JA.md) 保留为上游参考，尚未完整同步本分支差异。

## 协作与版本管理

- 功能修改从 `main` 创建独立分支，提交信息使用 `fix`、`feat`、`test`、`docs` 或 `build` 等明确类型。
- 引入上游更新时记录版本和提交，不覆盖本分支历史，不把未执行的验证写成通过。
- CI 用于代码检查，不连接生产服务器；本仓库不会自动执行上游的镜像发布与通知流程。
- 不提交 `.env`、Token、账号导出、生产配置、数据库备份、业务日志或本机构建产物。

## 来源与许可

感谢 [ranxi2001/sub2api](https://github.com/ranxi2001/sub2api) 与原始项目 [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) 的维护者及贡献者。

本仓库保留 [LICENSE](LICENSE)、[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和 [LICENSES](LICENSES)。第三方组件各自的许可声明不因本分支修改而改变。
