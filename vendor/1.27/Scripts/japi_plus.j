//设置可摧毁物位置
native DzDestructablePosition takes destructable d, real x, real y returns nothing

//设置单位位置-本地调用
native DzSetUnitPosition takes unit whichUnit, real x, real y returns nothing

//异步执行函数
native DzExecuteFunc takes string funcName returns nothing

//取鼠标指向的unit
native DzGetUnitUnderMouse takes nothing returns unit

//设置unit的贴图
native DzSetUnitTexture takes unit whichUnit, string path, integer texId returns nothing

//设置内存数值
native DzSetMemory takes integer address, real value returns nothing

//设置单位ID
native DzSetUnitID takes unit whichUnit, integer id returns nothing

//设置单位模型
native DzSetUnitModel takes unit whichUnit, string path returns nothing

//设置小地图背景图片
native DzSetWar3MapMap takes string map returns nothing

//获取war3语言
native DzGetLocale takes nothing returns string

//获取等级所需经验
native DzGetUnitNeededXP takes unit whichUnit, integer level returns integer

//沉默单位-禁用技能
native DzUnitSilence takes unit whichUnit, boolean disable returns nothing

//禁用攻击
native DzUnitDisableAttack takes unit whichUnit, boolean disable returns nothing

//禁用道具
native DzUnitDisableInventory takes unit whichUnit, boolean disable returns nothing

//刷新小地图
native DzUpdateMinimap takes nothing returns nothing

//修改单位alpha
native DzUnitChangeAlpha takes unit whichUnit, integer alpha, boolean forceUpdate returns nothing

//设置单位是否可以选中
native DzUnitSetCanSelect takes unit whichUnit, boolean state returns nothing

//修改单位是否可以被设置为目标
native DzUnitSetTargetable takes unit whichUnit, boolean state returns nothing

//判断单位血条是否显示
native DzUnitIsShowingHpBar takes unit whichUnit returns boolean

//获取单位头顶偏移
native DzUnitOverheadOffset takes unit whichUnit returns real

// 异步获取单位内存地址
native DzUnitGetAddress takes unit whichUnit returns integer

// 获取单位等级
native DzUnitGetLevel takes unit whichUnit returns integer

//保存内存数据
native DzSaveMemoryCache takes string cache returns nothing

//读取内存数据
native DzGetMemoryCache takes nothing returns string

//设置加速倍率
native DzSetSpeed takes real ratio returns nothing

//设置最大人口上限
native DzSetMiscCustomFoodCeiling takes integer value returns nothing

// 设置单位缓存数据-整数
native DzSetUnitDataCacheInteger takes integer unitTypeId, integer offset, integer index, integer value returns nothing

// 设置单位缓存数据-浮点数
native DzSetUnitDataCacheReal takes integer unitTypeId, integer offset, integer index, real value returns nothing

// 设置单位UI数据-整数
native DzUnitUIAddLevelArrayInteger takes integer unitTypeId, integer index, integer level, integer value returns nothing

// 清空单位UI数据
native DzUnitUIClearLevelArrayInteger takes integer unitTypeId, integer index, integer level returns nothing

// 查找单位技能
native DzUnitFindAbility takes unit whichUnit, integer abilId returns ability

// 设置单位移动类型
native DzUnitSetMoveType takes unit whichUnit, string moveType returns nothing

// 修改技能数据-字符串
native DzAbilitySetStringData takes ability whichAbility, string key, string value returns nothing

// 启用/禁用技能
native DzAbilitySetEnable takes ability whichAbility, boolean enable, boolean hideUI returns nothing

// 自定义指定单位的小地图图标
native DzWidgetSetMinimapIcon takes unit u, string path returns nothing

// 是否启动自定义指定单位的小地图图标
native DzWidgetSetMinimapIconEnable takes unit u, boolean enable returns nothing

// 设置特效动画
native DzSetEffectAnimation takes effect handle, integer index, integer flag returns nothing

// 设置特效位置
native DzSetEffectPos takes effect handle, real x, real y, real z returns nothing

// 播放特效动画
native DzPlayEffectAnimation takes effect handle, string anim, string link returns nothing

// 设置特效颜色
native DzSetEffectVertexColor takes effect handle, integer color returns nothing

// 设置特效透明度
native DzSetEffectVertexAlpha takes effect handle, integer alphareturns nothing

// 获取特效颜色
native DzGetEffectVertexColor takes effect handle returns integer

// 获取特效透明度
native DzGetEffectVertexAlpha takes effect handle returns integer

// 绑定特效
native DzBindEffect takes widget parent, string attachPoint, effect handle returns nothing

// 解除特效绑定
native DzUnbindEffect takes effect handle returns nothing

// 粒子缩放 单位
native DzSetWidgetSpriteScale takes widgethandle, real scale returns nothing

// 粒子缩放 特效
native DzSetEffectScale takes effect whichHandle, real scale returns nothing

// 特效显示/隐藏
native DzSetEffectVisible takes effect whichHandle, boolean enable returns nothing

// 设置特效模型
native DzSetEffectModel takes effect whichHandle, string modelFile returns nothing

// 设置特效队伍颜色
native DzSetEffectTeamColor takes effect whichHandle, integer playerId returns nothing

// 获取物品技能 handle
native DzGetItemAbility takes item handle, integer index returns ability

// 解锁 BLP 像素限制
native DzUnlockBlpSizeLimit takes boolean enable returns nothing

// 获取商店目标
native DzGetActivePatron takes unit store, player p returns unit

// 获取玩家选择单位列表数量
native DzGetLocalSelectUnitCount takes nothing returns integer

// 获取玩家选择单位列表
native DzGetLocalSelectUnit takes integer index returns unit

// 显示/隐藏FPS
native DzToggleFPS takes boolean show returns nothing

// 获取FPS
native DzGetFPS takes nothing returns integer

// 获取当前选择队长单位
native DzGetSelectedLeaderUnit takes nothing returns unit

// 获取字符串数量
native DzGetJassStringTableCount takes nothing returns integer

// 清除模型内存缓存
native DzModelRemoveFromCache takes string path returns nothing

// 清除所有模型内存缓存
native DzModelRemoveAllFromCache takes nothing returns nothing

// 监听模式变化事件-摆放建筑
native DzRegisterOnBuildLocal takes code func returns nothing
native DzGetOnBuildOrderId takes nothing returns integer
native DzGetOnBuildOrderType takes nothing returns integer
native DzGetOnBuildAgent takes nothing returns widget

// 监听模式变化事件-技能选目标
native DzRegisterOnTargetLocal takes code func returns nothing
native DzGetOnTargetAbilId takes nothing returns integer
native DzGetOnTargetOrderId takes nothing returns integer
native DzGetOnTargetOrderType takes nothing returns integer
native DzGetOnTargetAgent takes nothing returns widget
native DzGetOnTargetInstantTarget takes nothing returns widget

// 打开QQ群链接
native DzOpenQQGroupUrl takes string url returns boolean

// 设置维修费用
native DzSetMiscCustomUpkeepUsage takes integer level, integer value returns nothing

// 获取地图文件相对路径 Map\xxxx\xxx.w3x
native DzGetMapFilePath takes nothing returns string

// 设置剪切板内容
native DzSetClipboard takes string content returns boolean

// 复活单位
native DzReviveUnit takes unit whichUnit, player whichPlayer, real hp, real mp, real x, real y returns nothing

// 获取普攻技能
native DzGetAttackAbility takes unit whichUnit returns ability

// 结束普攻技能CD
native DzAttackAbilityEndCooldown takes ability whichHandle returns nothing

// 地形装饰物相关
native DzDoodadCreate takes integer id, integer var, real x, real y, real z, real rotate, real scale returns integer
native DzDoodadGetTypeId takes integer doodad returns integer
native DzDoodadSetModel takes integer doodad, string modelFile returns nothing
native DzDoodadSetTeamColor takes integer doodad, integer color returns nothing
native DzDoodadSetColor takes integer doodad, integer color returns nothing
native DzDoodadGetX takes integer doodad returns real
native DzDoodadGetY takes integer doodad returns real
native DzDoodadGetZ takes integer doodad returns real
native DzDoodadSetPosition takes integer doodad, real x, real y, real z returns nothing
native DzDoodadSetOrientMatrixRotate takes integer doodad, real angle, real axisX, real axisY, real axisZ returns nothing
native DzDoodadSetOrientMatrixScale takes integer doodad, real x, real y, real z returns nothing
native DzDoodadSetOrientMatrixResize takes integer doodad returns nothing
native DzDoodadSetVisible takes integer doodad, boolean enable returns nothing
native DzDoodadSetAnimation takes integer doodad, string animName, boolean animRandom returns nothing
native DzDoodadSetTimeScale takes integer doodad, real scale returns nothing
native DzDoodadGetTimeScale takes integer doodad returns real
native DzDoodadGetCurrentAnimationIndex takes integer doodad returns integer
native DzDoodadGetAnimationCount takes integer doodad returns integer
native DzDoodadGetAnimationName takes integer doodad, integer index returns string
native DzDoodadGetAnimationTime takes integer doodad, integer index returns integer
native DzDoodadRemove takes integer doodad returns nothing

// 设置道具模型
native DzItemSetModel takes item whichItem, string modelPath returns nothing

// 设置道具头像
native DzItemSetPortrait takes item whichItem, string modelPath returns nothing

// 设置道具颜色
native DzItemSetVertexColor takes item whichItem, integer color returns nothing

// 设置道具透明度
native DzItemSetAlpha takes item whichItem, integer alpha returns nothing

// 恢复默认颜色&透明度设置
native DzItemResetColor takes item whichItem returns nothing

// 解锁opcode限制
native DzUnlockOpCodeLimit takes boolean enable returns nothing

// 移除科技
native DzRemovePlayerTechResearched takes player whichPlayer, integer techid, integer removelevels returns nothing

// 打印日志
native DzWriteLog takes string log returns nothing
