export default function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({ message: "Hola desde la API (GET)" });
  } else if (req.method === "POST") {
    res.status(200).json({ message: "Hola desde la API (POST)" });
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Método ${req.method} no permitido`);
  }
}
