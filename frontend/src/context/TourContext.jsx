import { createContext, useContext } from 'react'

export const TourContext = createContext({
  tourRunning: false,
  startTour: () => {},
  stopTour: () => {},
})

export const useTour = () => useContext(TourContext)
