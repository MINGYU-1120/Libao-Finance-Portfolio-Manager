export default function handler(req, res) {
    res.status(200).json({
        ok: true,
        message: 'Kajabi Webhook Endpoint is Active (ESM)',
        query: req.query,
        body: req.body
    });
}
