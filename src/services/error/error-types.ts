/**
 * CheekyChimp基础错误类
 */
export class CheekyChimpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheekyChimpError';
  }
}

/**
 * 脚本注入错误
 */
export class ScriptInjectionError extends CheekyChimpError {
  constructor(
    public readonly scriptName: string,
    message: string
  ) {
    super(`注入脚本 "${scriptName}" 失败: ${message}`);
    this.name = 'ScriptInjectionError';
  }
}

/**
 * 脚本解析错误
 */
export class ScriptParsingError extends CheekyChimpError {
  constructor(message: string) {
    super(`解析脚本失败: ${message}`);
    this.name = 'ScriptParsingError';
  }
}

/**
 * 资源加载错误
 */
export class ResourceLoadError extends CheekyChimpError {
  constructor(
    public readonly resourceUrl: string,
    message: string
  ) {
    super(`加载资源 "${resourceUrl}" 失败: ${message}`);
    this.name = 'ResourceLoadError';
  }
}

/**
 * API调用错误
 */
export class APICallError extends CheekyChimpError {
  constructor(
    public readonly apiName: string,
    message: string
  ) {
    super(`API调用 "${apiName}" 失败: ${message}`);
    this.name = 'APICallError';
  }
}

/**
 * 存储操作错误
 */
export class StorageError extends CheekyChimpError {
  constructor(
    public readonly operation: string,
    message: string
  ) {
    super(`存储操作 "${operation}" 失败: ${message}`);
    this.name = 'StorageError';
  }
} 