module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
};
