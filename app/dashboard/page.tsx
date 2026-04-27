"use client"

import axios from "axios"
import { useEffect, useState } from "react"

export default function Dashboard() {

  const [signals, setSignals] = useState<any[]>([])

  useEffect(() => {

    async function fetchSignals() {

      try {

        const res = await axios.get(
          "https://api.the-odds-api.com/v4/sports/?apiKey=f451d589d6da6722c1858c133bcb9395"
        )

        console.log("DATA:", res.data)

        setSignals(res.data)

      } catch (err) {

        console.error("ERROR:", err)

      }

    }

    fetchSignals()

  }, [])

  return (

    <div style={{ padding: "20px", color: "#00ffcc" }}>

      <h1>ATLAS AI Dashboard</h1>

      <p>Total Sports: {signals.length}</p>

      {signals.map((sport, index) => (

        <div key={index} style={{
          border: "1px solid #00ffcc",
          margin: "10px",
          padding: "10px"
        }}>

          <p>Name: {sport.title}</p>
          <p>Key: {sport.key}</p>
          <p>Group: {sport.group}</p>
          <p>Status: {sport.active ? "ACTIVE" : "INACTIVE"}</p>

        </div>

      ))}

    </div>

  )

}