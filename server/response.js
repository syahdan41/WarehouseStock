const response = (StatusCode, data, message, res) => {
  res.status(StatusCode).json({
    payload: {
      status_code: StatusCode,
      datas: data,
      messages: message,
    },
    pagination: {
      prev: "",
      next: "",
      max: "",
    },
  });
};

module.exports = response;
