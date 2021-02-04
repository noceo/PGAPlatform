import { injectable } from 'inversify'
import { ICountdownEvents, EventMap, ITimer } from './timer.types'

@injectable()
export class Timer implements ITimer {
  private _timeStep: number
  private _timeToNextTick: number
  private _timer?: NodeJS.Timeout
  private _listeners: EventMap<ICountdownEvents>

  constructor() {
    this._timeStep = 0
    this._timeToNextTick = 1000
    this._listeners = { tick: [], stop: [] }
  }

  on<K extends keyof ICountdownEvents>(
    eventName: K,
    listener: ICountdownEvents[K]
  ): void {
    this._listeners[eventName].push(listener)
  }

  off<K extends keyof ICountdownEvents>(
    eventName: K,
    listener: ICountdownEvents[K]
  ): void {
    const listeners = this._listeners[eventName]
    const index = listeners.indexOf(listener)
    if (index !== -1) {
      listeners.splice(index, 1)
    }
  }

  start() {
    if (this._timeToNextTick) {
      const tick = () => {
        this._listeners.tick.forEach((listener) => listener())
        this._timeStep += 1
      }
      tick()
      this._timer = setInterval(tick, this._timeToNextTick)
    }
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer)
    }
  }

  reset() {
    this.stop()
    this._timeStep = 0
  }

  get timestep(): number {
    return this._timeStep
  }

  get timeToNextTick() {
    return this._timeToNextTick
  }

  set timeToNextTick(time: number) {
    if (time <= 1000) {
      throw new Error('Time interval must be gretaer than 1000')
    }
    this._timeToNextTick = time
  }

  isRunning() {
    return !!this._timer
  }
}
