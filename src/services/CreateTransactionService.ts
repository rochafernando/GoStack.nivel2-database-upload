import { getRepository, getCustomRepository } from 'typeorm';
import AppError from '../errors/AppError';

import TransactionRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface TransactionDTO {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: TransactionDTO): Promise<Transaction> {
    const categoryRepository = getRepository(Category);
    const transactionRepository = getCustomRepository(TransactionRepository);

    if (!['income', 'outcome'].includes(type))
      throw new AppError('Transaction type is invalid');

    const { total } = await transactionRepository.getBalance();

    if (type === 'outcome' && value > total)
      throw new AppError('You do not have enough balance');

    if (!category) throw new AppError('Category cannot be null');

    const checkCategoryExists = await categoryRepository.findOne({
      where: { title: category },
    });

    let newCategory: Category;

    if (!checkCategoryExists) {
      newCategory = categoryRepository.create({ title: category });
      await categoryRepository.save(newCategory);
    } else {
      newCategory = checkCategoryExists;
    }

    const transaction = await transactionRepository.create({
      title,
      type,
      value,
      category_id: newCategory.id,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
