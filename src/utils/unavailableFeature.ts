export function throwUnavailableFeature(feature: string): never {
  throw new Error(
    `${feature} is unavailable in this reconstructed BotValia Code build.`,
  )
}
