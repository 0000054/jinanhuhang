# 暨南护航

面向高校用户的 Chrome / Edge Manifest V3 反钓鱼扩展原型。它在本地分析页面 URL、校园相关语义、敏感输入和表单目标，并显示风险提示。高风险页面可能触发遮挡确认。

> 本项目是实验性原型，不是安全产品或官方校方服务。规则检测可能漏报或误报，请勿将其作为输入密码、付款或访问链接的唯一依据。

## 功能

- 在浏览器本地分析页面并显示风险等级和判断依据。
- 检查仿冒校园域名、敏感信息输入和跨域表单提交。
- 配置校园和自定义可信域名、启用状态及可选反馈接口。
- 未配置反馈接口时，将反馈保存在本地扩展存储中。

## 安装

1. 下载或克隆此仓库。
2. 打开 `chrome://extensions` 或 `edge://extensions`，启用开发者模式。
3. 选择“加载已解压的扩展程序”，并选择仓库目录。
4. 打开网页后点击工具栏中的“暨南护航”查看扫描结果。

扩展在普通网页上运行不需要文件 URL 权限。要测试 `demo-pages/` 中的演示页面，可在仓库根目录运行：

```powershell
py -m http.server 8080 --directory demo-pages
```

然后访问 `http://localhost:8080/` 下的演示页面。

## 开发与测试

需要 Node.js 20 或更新版本。运行规则测试：

```sh
npm test
```

扩展无需构建步骤；在浏览器扩展管理页重新加载即可应用源码修改。

## 项目结构

- `src/core/`：学校域名和本地风险规则。
- `src/content/`：页面信号采集和风险提示。
- `src/background/`：浏览器徽章、扫描结果和反馈处理。
- `src/popup/`：当前页面结果。
- `src/options/`：扩展设置。
- `test/`：规则回归测试。
- `demo-pages/`：仅用于本地测试的静态演示页面。

## 隐私

页面文本和表单信息由扩展在本地检查。配置反馈接口后，用户主动提交的反馈会发送到该地址；反馈可能包含页面 URL 和检测结果。未配置接口时，反馈保存在浏览器本地。请只配置你信任的接口，并在发布前检查浏览器权限和代码行为。

## 参考

设计思路参考了 [picopalette/phishing-detection-plugin](https://github.com/picopalette/phishing-detection-plugin) 和 [codeesura/Anti-phishing-extension](https://github.com/codeesura/Anti-phishing-extension)。本项目为适配校园场景的独立实现。参考项目各自的许可条款适用于其原始代码；本仓库不包含其源码副本。

## 许可证

本项目以 MIT License 发布，见 [LICENSE](LICENSE)。
