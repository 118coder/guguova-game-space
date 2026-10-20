# 内置全屏缩放引擎：Magpie 0.12.1

本目录随 GUGUOVA 发行包一起分发一个**未经修改**的 Magpie 官方发行版，路径：

```
engine\magpie\
  Magpie.exe
  Microsoft.UI.Xaml.dll
  resources.pri
  TouchHelper.exe
  Updater.exe
  effects\
  LICENSE-GPL-3.0.txt
  NOTICE.md
  SOURCE-OFFER.txt
```

## 许可

- Magpie 由 Blinue 开发，采用 **GNU General Public License v3.0**。
- 许可证全文见 `LICENSE-GPL-3.0.txt`。
- 上游项目：<https://github.com/Blinue/Magpie>
- 本发行版对应上游标签：`v0.12.1`（官方 x64 发行 zip）。
- 本目录中的文件未做修改。Magpie 的图标、名称与版权归其作者所有。

## 与启动器的关系

Magpie 作为**独立进程**运行。GUGUOVA：

1. 在需要全屏缩放时启动 `Magpie.exe`；
2. 把主窗口收进托盘/最小化；
3. 通过 Magpie 自己注册的全局快捷键触发缩放；
4. 通过它公开的窗口属性（`Magpie.SrcHWND` 等）确认缩放已接管；
5. 读取/写入 `%LOCALAPPDATA%\Magpie\config\v*\config.json` 里的 `shortcuts.scale`，
   让启动器里设置的快捷键与 Magpie 一致。

启动器不链接 Magpie 的代码、不修改 Magpie 的二进制，也不把 Magpie 当作库使用。
两者是独立程序（mere aggregation）。GUGUOVA 自身的代码仍按项目许可分发；
Magpie 部分只受 GPLv3 约束。

## 源码

GPLv3 要求随目标代码分发时提供对应源码。`SOURCE-OFFER.txt` 是书面提供源码的说明；
上游源码也可直接从 <https://github.com/Blinue/Magpie/tree/v0.12.1> 获取。

如果你不需要内置引擎，删除整个 `engine\magpie\` 目录即可；启动器会自动退回
内置的无边框全屏（`scalingEngine=native` / `auto` 的兜底路径）。
