interface IConfigParameter {
  name: string
}

export interface INumericConfigParameter extends IConfigParameter {
  min: number
  max: number
  value: number
}

export interface ITextConfigParameter extends IConfigParameter {
  regex: string
  value: string
}

export interface ILiveConfigParameter extends IConfigParameter {
  value: number
}

export interface IParameterConfig {
  numericParameters: Array<INumericConfigParameter>
  textParameters: Array<ITextConfigParameter>
  liveParameters: Array<ILiveConfigParameter>
}
