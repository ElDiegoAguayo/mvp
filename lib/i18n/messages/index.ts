import type { Locale } from '../config'
import { es, type Messages } from './es'
import { en } from './en'

export const messages: Record<Locale, Messages> = { es, en }

export type { Messages }
