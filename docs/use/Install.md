# 安装指南

## 前置要求

-   **LeviLamina**: 确保你的服务器已安装并运行 LeviLamina 加载器，并安装[LegacyScriptEngine脚本引擎](https://github.com/LiteLDev/LegacyScriptEngine)，下载lse的nodejs版本！推荐使用lip安装此前置。
-  **安装相关的事件库** 由于lse的原版事件的缺乏，你还需要安装ila事件库，[iListenAttentively](https://github.com/MiracleForest/iListenAttentively-Release)和[iListenAttentively-LseExport](https://github.com/MiracleForest/iListenAttentively-LseExport)
-  **安装PlayerData** 此插件也要安装，[PlayerData](https://www.minebbs.com/resources/playerdata.10899/)

-   **(可选) BSCI 库**: 如果你想使用区域可视化功能 (例如选点时的框线)，你需要安装[BSCI](https://github.com/OEOTYAN/BedrockServerClientInterface)和[bsci-LegacyRemoteCallApi](https://www.minebbs.com/resources/bsci-legacyremotecallapi-bedrockserverclientinterface-api-lse.10969/)，并安装[BSCI资源包](https://github.com/OEOTYAN/BedrockServerClientInterface/tree/main/assets/BSCIPack)。

## 安装步骤

1.  **下载插件**: 从发布页面或源代码仓库获取 `CzAreaProtection` 插件的最新版本。
2. **安装前置**: 安装完上述的前置
3.  **放置插件**: 将下载的 `CzAreaProtection` 文件夹完整地放入你服务器的 `plugins` 目录下。
4.  **重启服务器**: 重启你的 Minecraft 服务器以加载插件。

## 首次加载

插件首次加载时会自动执行以下操作：

-   在 `plugins/area/` 目录下创建默认的 `config.json` 配置文件和`permissions.json`。
-   在 `plugins/area/` 目录下创建 `data.db` 用于存储此插件的全部数据

## 更新插件

1.  **备份数据**: 在更新前，建议备份 `plugins/area/` 目录下的数据文件，以防数据损坏。
2.  **删除旧版**: 删除旧的 `CzAreaProtection` 插件文件夹。
3.  **放置新版**: 将新版本的 `CzAreaProtection` 文件夹放入 `plugins` 目录，。
4.  **重启服务器**: 重启服务器。插件会自动处理配置文件的更新（如果版本不匹配）。

## 常见问题

-   **是否适配新版本**: 插件是否适配新版本取决于前置库的接口是否发生改变，若它们的api没有变动，理论上插件本体不用更新就能适配
