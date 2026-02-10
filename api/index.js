module.exports = (req, res) => {
    res.status(200).json({
        ok: true,
        message: 'Kajabi Webhook Endpoint is Active',
        query: req.query,
        body: req.body
    });
};
