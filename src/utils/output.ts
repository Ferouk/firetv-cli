import chalk from 'chalk'
export const success = (message: string) => console.log(`${chalk.green('✓')} ${message}`)
export const info = (message: string) => console.log(message)
export const fail = (message: string) => console.error(`${chalk.red('Error:')} ${message}`)
