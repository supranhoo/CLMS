import zxcvbn from 'zxcvbn';

export const validatePassword = (password) => {
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  const isFormatStrong = strongRegex.test(password);
  const zxcvbnScore = zxcvbn(password).score; // 0 (worst) to 4 (best)

  return {
    isFormatStrong,
    zxcvbnScore,
    isStrong: isFormatStrong && zxcvbnScore >= 3 // final decision
  };
};
