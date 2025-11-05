//获取鼠标在游戏内的坐标X
native DzGetMouseTerrainX takes nothing returns real

//获取鼠标在游戏内的坐标Y
native DzGetMouseTerrainY takes nothing returns real

//获取鼠标在游戏内的坐标Z
native DzGetMouseTerrainZ takes nothing returns real

//鼠标是否在游戏内
native DzIsMouseOverUI takes nothing returns boolean

//获取鼠标屏幕坐标X
native DzGetMouseX takes nothing returns integer

//获取鼠标屏幕坐标Y
native DzGetMouseY takes nothing returns integer

//获取鼠标游戏窗口坐标X
native DzGetMouseXRelative takes nothing returns integer

//获取鼠标游戏窗口坐标Y
native DzGetMouseYRelative takes nothing returns integer

//设置鼠标位置
native DzSetMousePos takes integer x, integer y returns nothing

//注册鼠标点击触发（sync为true时，调用TriggerExecute。为false时，直接运行action函数，可以异步不掉线，action里不要有同步操作）
native DzTriggerRegisterMouseEvent takes trigger trig, integer btn, integer status, boolean sync, string func returns nothing
native DzTriggerRegisterMouseEventByCode takes trigger trig, integer btn, integer status, boolean sync, code funcHandle returns nothing

//注册键盘点击触发
native DzTriggerRegisterKeyEvent takes trigger trig, integer key, integer status, boolean sync, string func returns nothing
native DzTriggerRegisterKeyEventByCode takes trigger trig, integer key, integer status, boolean sync, code funcHandle returns nothing

//注册鼠标滚轮触发
native DzTriggerRegisterMouseWheelEvent takes trigger trig, boolean sync, string func returns nothing
native DzTriggerRegisterMouseWheelEventByCode takes trigger trig, boolean sync, code funcHandle returns nothing

//注册鼠标移动触发
native DzTriggerRegisterMouseMoveEvent takes trigger trig, boolean sync, string func returns nothing
native DzTriggerRegisterMouseMoveEventByCode takes trigger trig, boolean sync, code funcHandle returns nothing

//获取触发器的按键码
native DzGetTriggerKey takes nothing returns integer

//获取滚轮delta
native DzGetWheelDelta takes nothing returns integer

//判断按键是否按下
native DzIsKeyDown takes integer iKey returns boolean

//获取触发key的玩家
native DzGetTriggerKeyPlayer takes nothing returns player

//获取war3窗口宽度
native DzGetWindowWidth takes nothing returns integer

//获取war3窗口高度
native DzGetWindowHeight takes nothing returns integer

//获取war3窗口client宽度
native DzGetClientWidth takes nothing returns integer

//获取war3窗口client高度
native DzGetClientHeight takes nothing returns integer

//获取war3窗口X坐标
native DzGetWindowX takes nothing returns integer

//获取war3窗口Y坐标
native DzGetWindowY takes nothing returns integer

//注册war3窗口大小变化事件
native DzTriggerRegisterWindowResizeEvent takes trigger trig, boolean sync, string func returns nothing
native DzTriggerRegisterWindowResizeEventByCode takes trigger trig, boolean sync, code funcHandle returns nothing

//判断窗口是否激活
native DzIsWindowActive takes nothing returns boolean

// 设置窗口大小
native DzChangeWindowSize takes integer width, integer height returns boolean

// 是否窗口模式
native DzIsWindowMode takes nothing returns boolean

