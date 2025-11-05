/////////////////////////////// 原生UI修改
//隐藏界面元素
native DzFrameHideInterface takes nothing returns nothing

//修改游戏世界窗口位置
native DzFrameEditBlackBorders takes real upperHeight, real bottomHeight returns nothing

//头像
native DzFrameGetPortrait takes nothing returns integer

//小地图
native DzFrameGetMinimap takes nothing returns integer

//技能按钮
native DzFrameGetCommandBarButton takes integer row, integer column returns integer

//英雄按钮
native DzFrameGetHeroBarButton takes integer buttonId returns integer

//英雄血条
native DzFrameGetHeroHPBar takes integer buttonId returns integer

//英雄蓝条
native DzFrameGetHeroManaBar takes integer buttonId returns integer

//道具按钮
native DzFrameGetItemBarButton takes integer buttonId returns integer

//小地图按钮
native DzFrameGetMinimapButton takes integer buttonId returns integer

//左上菜单按钮
native DzFrameGetUpperButtonBarButton takes integer buttonId returns integer

//鼠标提示
native DzFrameGetTooltip takes nothing returns integer 

//聊天信息
native DzFrameGetChatMessage takes nothing returns integer 

//unit message
native DzFrameGetUnitMessage takes nothing returns integer 

//top message
native DzFrameGetTopMessage takes nothing returns integer 

// 获取通知信息框（施法失败）
native DzFrameGetWorldFrameMessage takes nothing returns integer

// 信息框-添加文本（错误、聊天等）
native DzSimpleMessageFrameAddMessage takes integer frame, string text, integer color, real duration, boolean permanent returns nothing

// 信息框-清除（错误、聊天等）
native DzSimpleMessageFrameClear takes integer frame returns nothing

///////////////////////////////
//取rgba色值
native DzGetColor takes integer a, integer r, integer g, integer b returns integer

//设置界面更新回调（非同步）
native DzFrameSetUpdateCallback takes string func returns nothing
native DzFrameSetUpdateCallbackByCode takes code funcHandle returns nothing

//显示/隐藏Frame
native DzFrameShow takes integer frame, boolean enable returns nothing

//显示/隐藏SimpleFrame
native DzSimpleFrameShow takes integer frame, boolean enable returns nothing

// Frame是否显示
native DzFrameIsVisible takes integer frame returns boolean

// SimpleFrame是否显示
native DzSimpleFrameIsVisible takes integer frame returns boolean

//创建frame
native DzCreateFrame takes string frame, integer parent, integer id returns integer

//创建SimpleFrame
native DzCreateSimpleFrame takes string frame, integer parent, integer id returns integer

//销毁frame
native DzDestroyFrame takes integer frame returns nothing

//加载toc
native DzLoadToc takes string fileName returns nothing

//设置frame相对位置
native DzFrameSetPoint takes integer frame, integer point, integer relativeFrame, integer relativePoint, real x, real y returns nothing

//设置frame绝对位置
native DzFrameSetAbsolutePoint takes integer frame, integer point, real x, real y returns nothing

//清空frame锚点
native DzFrameClearAllPoints takes integer frame returns nothing

// 判断是否有该锚点
native DzFrameGetPointValid takes integer frame, integer anchor returns boolean

// 获取相对锚点的FRAME
native DzFrameGetPointRelative takes integer frame, integer anchor returns integer

// 回去相对锚点的FRAME锚点
native DzFrameGetPointRelativePoint takes integer frame, integer anchor returns integer

// 获取锚点X
native DzFrameGetPointX takes integer frame, integer anchor returns real

// 获取锚点Y
native DzFrameGetPointY takes integer frame, integer anchor returns real

//设置frame禁用/启用
native DzFrameSetEnable takes integer name, boolean enable returns nothing

//注册UI事件回调-仅在游戏模式响应-观战、录像等不响应
native DzFrameSetScript takes integer frame, integer eventId, string func, boolean sync returns nothing
native DzFrameSetScriptByCode takes integer frame, integer eventId, code funcHandle, boolean sync returns nothing
native DzFrameSetScriptBlock takes integer frame, integer eventId, code funcHandle, boolean sync returns nothing
//注册UI事件回调-异步，可以在游戏、录像、观战等所有模式响应
native DzFrameSetScriptAsync integer frame, integer eventId, string funcName returns nothing
native DzFrameSetScriptByCodeAsync integer frame, integer eventId, code func returns nothing
native DzFrameSetScriptBlockAsync integer frame, integer eventId, code func returns nothing

//获取触发ui的玩家
native DzGetTriggerUIEventPlayer takes nothing returns player

//获取触发的Frame
native DzGetTriggerUIEventFrame takes nothing returns integer

//查找frame
native DzFrameFindByName takes string name, integer id returns integer

//查找SimpleFrame
native DzSimpleFrameFindByName takes string name, integer id returns integer

//查找String
native DzSimpleFontStringFindByName takes string name, integer id returns integer

//查找Texture
native DzSimpleTextureFindByName takes string name, integer id returns integer

//获取game ui
native DzGetGameUI takes nothing returns integer

//获取simple game ui
native DzGetSimpleUIParent takes nothing returns integer

//获取鼠标UI
native DzGetCursorFrame takes nothing returns integer

//点击frame
native DzClickFrame takes integer frame returns nothing

//自定义屏幕比例
native DzSetCustomFovFix takes real value returns nothing

//使用宽屏模式
native DzEnableWideScreen takes boolean enable returns nothing

//设置文字（支持EditBox, TextFrame, TextArea, SimpleFontString、GlueEditBoxWar3、SlashChatBox、TimerTextFrame、TextButtonFrame、GlueTextButton）
native DzFrameSetText takes integer frame, string text returns nothing

//追加文字（支持TextArea）
native DzFrameAddText takes integer frame, string text returns nothing

//获取文字（支持EditBox, TextFrame, TextArea, SimpleFontString）
native DzFrameGetText takes integer frame returns string

//设置字数限制（支持EditBox）
native DzFrameSetTextSizeLimit takes integer frame, integer size returns nothing

//获取字数限制（支持EditBox）
native DzFrameGetTextSizeLimit takes integer frame returns integer

//设置文字颜色（支持TextFrame, EditBox）
native DzFrameSetTextColor takes integer frame, integer color returns nothing

//获取鼠标所在位置的ui控件指针
native DzGetMouseFocus takes nothing returns integer

//设置所有锚点到目标frame上
native DzFrameSetAllPoints takes integer frame, integer relativeFrame returns boolean

//设置焦点
native DzFrameSetFocus takes integer frame, boolean enable returns boolean

//设置模型（支持Sprite、Model、StatusBar）
native DzFrameSetModel takes integer frame, string modelFile, integer modelType, integer flag returns nothing

//获取控件是否启用
native DzFrameGetEnable takes integer frame returns boolean

//设置透明度（0-255）
native DzFrameSetAlpha takes integer frame, integer alpha returns nothing

//获取透明度
native DzFrameGetAlpha takes integer frame returns integer

//设置动画
native DzFrameSetAnimate takes integer frame, integer animId, boolean autocast returns nothing

//设置动画进度（autocast为false是可用）
native DzFrameSetAnimateOffset takes integer frame, real offset returns nothing

//设置动画
native DzFrameSetAnimateByIndex takes integer frame, integer index, integer flag returns nothing

//设置texture（支持Backdrop、SimpleStatusBar、SimpleTexture）
native DzFrameSetTexture takes integer frame, string texture, integer flag returns nothing

//设置缩放
native DzFrameSetScale takes integer frame, real scale returns nothing

//设置tooltip
native DzFrameSetTooltip takes integer frame, integer tooltip returns nothing

//鼠标限制在ui内
native DzFrameCageMouse takes integer frame, boolean enable returns nothing

//获取当前值（支持Slider、SimpleStatusBar、StatusBar）
native DzFrameGetValue takes integer frame returns real

//设置最大最小值（支持Slider、SimpleStatusBar、StatusBar）
native DzFrameSetMinMaxValue takes integer frame, real minValue, real maxValue returns nothing

//设置Step值（支持Slider）
native DzFrameSetStepValue takes integer frame, real step returns nothing

// 设置当前值（支持Slider、SimpleStatusBar、StatusBar、PopupMenu、GluePopupMenuWar3）
native DzFrameSetValue takes integer frame, real value returns nothing

//设置frame大小
native DzFrameSetSize takes integer frame, real w, real h returns nothing

//根据tag创建frame
native DzCreateFrameByTagName takes string frameType, string name, integer parent, string template, integer id returns integer

//设置颜色（支持SimpleStatusBar、SimpleTexture）
native DzFrameSetVertexColor takes integer frame, integer color returns nothing

// 1.29部分原生UI会自动重设位置大小等，如果需要自定义位置，需要关闭
native DzOriginalUIAutoResetPoint takes boolean enable returns nothing

// 设置frame优先级
native DzFrameSetPriority takes integer frame, integer priority returns nothing

// 设置父窗口
native DzFrameSetParent takes integer frame, integer parent returns nothing

// 获取控件高度
native DzFrameGetHeight takes integer frame returns real

// 获取控件宽度
native DzFrameGetWidth takes integer frame returns real

// 设置字体（支持EditBox、SimpleFontString、SimpleMessageFrame以及非SimpleFrame类型的例如TEXT）
native DzFrameSetFont takes integer frame, string fileName, real height, integer flag returns nothing

// 获取parent
native DzFrameGetParent takes integer frame returns integer
// 获取子控件数量
native DzFrameGetChildrenCount takes integer frame returns integer
// 获取子控件
native DzFrameGetChild takes integer frame, integer index returns integer

// 设置文字（支持EditBox, TextFrame, TextArea, SimpleFontString、SimpleButton）
native DzFrameSetTextAlignment takes integer frame, integer align returns nothing
// 设置禁用态文字（支持SimpleButton）
native DzFrameSetDisabledText takes integer frame, integer align returns nothing
// 设置悬浮态态文字（支持SimpleButton）
native DzFrameSetHighlightText takes integer frame, integer align returns nothing

// 获取frame名称
native DzFrameGetName takes integer frame returns string

// 转换世界坐标为屏幕坐标-异步
native DzConvertWorldPosition takes real x, real y, real z, code callback returns boolean
// 转换世界坐标为屏幕坐标-获取转换后的X坐标
native DzGetConvertWorldPositionX takes nothing returns real
// 转换世界坐标为屏幕坐标-获取转换后的Y坐标
native DzGetConvertWorldPositionY takes nothing returns real

// 转换世界坐标屏幕坐标X
native DzConvertWorldPositionX takes real x, real y, real z returns real
// 转换世界坐标屏幕坐标Y
native DzConvertWorldPositionY takes real x, real y, real z returns real
// 转换世界坐标屏幕坐标Depth
native DzConvertWorldPositionDepth takes real x, real y, real z returns real

// 转换屏幕坐标到世界坐标X
native DzConvertScreenPositionX takes real x, real y returns real
// 转换屏幕坐标到世界坐标Y
native DzConvertScreenPositionY takes real x, real y returns real

// 创建command button
native DzCreateCommandButton takes integer parent, string icon, string name, string desc returns integer

// 聊天框是否打开
native DzIsChatBoxOpen takes nothing return boolean

// 设置UI超框是否裁剪
native DzFrameSetClip takes integer frame, boolean enable returns nothing

// 获取单位选择队列按钮
native DzFrameGetInfoPanelSelectButton takes integer index returns integer

// 获取BUFF按钮
native DzFrameGetInfoPanelBuffButton takes integer index returns integer

// 获取农民按钮
native DzFrameGetPeonBar takes nothing returns integer

// 技能按钮-数字文本 simple font string
native DzFrameGetCommandBarButtonNumberText takes integer frame returns integer

// 技能按钮-数字OVERLAY simple frame
native DzFrameGetCommandBarButtonNumberOverlay takes integer frame returns integer

// 技能按钮-冷却指示器 sprite frame
native DzFrameGetCommandBarButtonCooldownIndicator takes integer frame returns integer

// 技能按钮-自动施法指示器 sprite frame
native DzFrameGetCommandBarButtonAutoCastIndicator takes integer frame returns integer

// 转换世界坐标至小地图坐标-左下角0,0
native DzFrameWorldToMinimapPosX takes real x, real y returns real
native DzFrameWorldToMinimapPosY takes real x, real y returns real

// 是否启用UI范围裁剪
native DzFrameEnableClipRect takes boolean enable returns nothing

// 获取单位的血条控件
native DzFrameGetUnitHpBar takes unit whichUnit returns integer

// 监听单位血条更新
native DzFrameHookHpBar takes code func returns nothing

// 获取单位血条事件血条控件
native DzFrameGetTriggerHpBar takes nothing returns integer

// 获取单位血条事件单位
native DzFrameGetTriggerHpBarUnitAddress takes nothing returns integer
