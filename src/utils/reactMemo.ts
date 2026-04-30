import * as React from 'react'

/**
 * Reconstructed Bun/React typings in this repo only expose the 1-arg memo
 * signature, but several components rely on a props comparator for scrollback
 * performance. Cast back to the standard React.memo overload locally.
 */
export function memoWithComparator<P extends object>(
  component: (props: P) => React.ReactNode,
  propsAreEqual: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean,
): (props: P) => React.ReactNode {
  return (
    React.memo as unknown as (
      component: (props: P) => React.ReactNode,
      propsAreEqual: (
        prevProps: Readonly<P>,
        nextProps: Readonly<P>,
      ) => boolean,
    ) => (props: P) => React.ReactNode
  )(component, propsAreEqual)
}
